// @vitest-environment happy-dom
// The compiler may ship minified inside another bundle, such as the website's REPL. Its chunks
// and its `idlip/helpers` module must not depend on that: they match the unbundled compiler
// byte for byte, and the helpers run.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';
import * as blocks from '../../src/client/patch/blocks.ts';
import { parseHtml } from '../../src/client/patch/dom.ts';
import { compile, printHelpersModule } from '../../src/compiler/index.ts';
import { bindImports, toDataUrl } from '../../src/testing/modules.ts';

const ROOT = path.join(import.meta.dirname, '../..');
const ENTRY = path.join(ROOT, 'src/compiler/index.ts');
const CACHE = path.join(ROOT, 'node_modules/.cache');
const SOURCE = `export default function Counter() {
  let count = 0;
  const label = \`Count: \${count}\`;
  function increment() {
    count += 1;
  }
  return (
    <button on:click={increment}>
      {label}
    </button>
  );
}
`;

interface Compiler {
  compile: typeof compile;
  printHelpersModule: typeof printHelpersModule;
}

function isCompiler(value: unknown): value is Compiler {
  return (
    typeof Reflect.get(Object(value), 'compile') === 'function' &&
    typeof Reflect.get(Object(value), 'printHelpersModule') === 'function'
  );
}

const folders: string[] = [];

afterAll(() => {
  for (const folder of folders) {
    rmSync(folder, { recursive: true, force: true });
  }
});

/** Bundles and minifies the compiler with Vite's bundler, no `keepNames`, and imports it. */
async function importMinified(): Promise<Compiler> {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: true,
      lib: { entry: ENTRY, formats: ['es'], fileName: 'compiler' },
      rolldownOptions: { external: ['oxc-parser', 'seroval', /^node:/] },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  mkdirSync(CACHE, { recursive: true });
  const folder = mkdtempSync(path.join(CACHE, 'min-'));
  folders.push(folder);
  let entry = '';
  for (const output of outputs) {
    if (!('output' in output)) {
      continue;
    }
    for (const item of output.output) {
      if (item.type === 'chunk') {
        writeFileSync(path.join(folder, item.fileName), item.code);
        entry = item.isEntry ? item.fileName : entry;
      }
    }
  }
  const module: unknown = await import(
    /* @vite-ignore */ pathToFileURL(path.join(folder, entry)).href
  );
  if (!isCompiler(module)) {
    throw new TypeError('The minified bundle does not export the compiler');
  }
  return module;
}

describe('the compiler in a minified bundle', () => {
  it('writes the same chunks and helpers as the unbundled compiler', async () => {
    const minified = await importMinified();
    expect(minified.compile.name).not.toBe('compile');
    const expected = compile(SOURCE, '/src/counter.tsx');
    const actual = minified.compile(SOURCE, '/src/counter.tsx');
    expect(expected.diagnostics).toEqual([]);
    expect(expected.client.length).toBeGreaterThan(0);
    expect(actual).toEqual(expected);
    expect(minified.printHelpersModule()).toBe(printHelpersModule());
  }, 60_000);

  it('writes a helpers module that runs', async () => {
    const minified = await importMinified();
    Reflect.set(globalThis, '$idlipMinifiedTest', {
      client: {
        addBlock: blocks.addBlock,
        findInnerBlocks: blocks.findInnerBlocks,
        parseHtml,
        removeBlock: blocks.removeBlock,
      },
    });
    const module: unknown = await import(
      /* @vite-ignore */ toDataUrl(bindImports(minified.printHelpersModule(), '$idlipMinifiedTest'))
    );
    const setAttr = Reflect.get(Object(module), 'setAttr$') as unknown;
    const text = Reflect.get(Object(module), 'text$') as unknown;
    expect(typeof setAttr).toBe('function');
    const el = document.createElement('p');
    if (typeof setAttr === 'function') {
      Reflect.apply(setAttr, undefined, [el, 'class', { a: true, b: false }]);
    }
    expect(el.getAttribute('class')).toBe('a');
    expect(typeof text === 'function' ? Reflect.apply(text, undefined, ['<a&b>']) : '').toBe(
      '&lt;a&amp;b&gt;',
    );
  }, 60_000);
});

describe('helpers-source.ts', () => {
  it('matches the helper sources', () => {
    execFileSync('node', ['scripts/generate-helpers.ts', '--check'], { cwd: ROOT });
  }, 60_000);
});
