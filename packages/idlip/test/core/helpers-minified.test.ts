// @vitest-environment happy-dom
// The `idlip/helpers` module is written from the text of the helper functions. A published
// build of the package may be minified: then the module must still work, or fail with the
// rename error, never produce a module that calls a name it does not define.
import path from 'node:path';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';
import * as blocks from '../../src/client/patch/blocks.ts';
import { parseHtml } from '../../src/client/patch/dom.ts';
import { bindImports, toDataUrl } from '../../src/testing/modules.ts';

const ENTRY = path.join(import.meta.dirname, '../../src/core/helpers.ts');

/** Bundles and minifies `core/helpers.ts` with Vite's bundler, and imports the result. */
async function importMinified(keepNames: boolean): Promise<Record<string, unknown>> {
  const result = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: true,
      lib: { entry: ENTRY, formats: ['es'], fileName: 'helpers' },
      rolldownOptions: { output: { keepNames } },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  let code = '';
  for (const output of outputs) {
    if (!('output' in output)) {
      continue;
    }
    for (const item of output.output) {
      if (item.type === 'chunk' && item.isEntry) {
        code = item.code;
      }
    }
  }
  const module: unknown = await import(/* @vite-ignore */ toDataUrl(code));
  const exports: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(
    typeof module === 'object' && module !== null ? module : {},
  )) {
    exports[name] = value;
  }
  return exports;
}

function callPrint(exports: Record<string, unknown>): string {
  const print = exports.printHelpersModule;
  if (typeof print !== 'function') {
    throw new TypeError('no printHelpersModule');
  }
  return String(Reflect.apply(print, undefined, []));
}

describe('printHelpersModule from a minified build', () => {
  it('throws the rename error when the minifier renamed the helpers', async () => {
    const exports = await importMinified(false);
    expect(() => callPrint(exports)).toThrow(/^The (helper|forwarder) \w+\$ was renamed to /);
  }, 60_000);

  it('writes a working module when the build keeps names', async () => {
    const source = callPrint(await importMinified(true));
    Reflect.set(globalThis, '$idlipMinifiedTest', {
      client: {
        addBlock: blocks.addBlock,
        findInnerBlocks: blocks.findInnerBlocks,
        parseHtml,
        removeBlock: blocks.removeBlock,
      },
    });
    const module: unknown = await import(
      /* @vite-ignore */ toDataUrl(bindImports(source, '$idlipMinifiedTest'))
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
