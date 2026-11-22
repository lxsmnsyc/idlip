import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createBuilder } from 'vite';
import { describe, expect, it } from 'vitest';
import { compile as compileSource } from '../../src/compiler/index.ts';
import type { CompileResult } from '../../src/core/format.ts';
import { getDefines, getFeatures, replaceFeatures } from '../../src/vite/features.ts';
import { compileFixture, createCheckedCompile, createConfig } from './app.ts';

const PACKAGE = path.resolve(import.meta.dirname, '../..');
const FIXTURES = path.join(PACKAGE, 'test/fixtures');
const LOADER = path.join(PACKAGE, 'src/client/index.ts');
/** Text that only the task runner and the keyed diff hold. */
const TASK_CODE = 'idlip: no task for';
const KEYED_CODE = '\\[(\\w+)=';
/** Text that only the loader code of dynamic holes holds. */
const DYNAMIC_CODE = '$dynamic';

type CompileFn = (source: string, id: string) => CompileResult;

function compileKeyed(source: string, id: string): CompileResult {
  const result = compileFixture(source, id);
  const groups = {
    ...result.manifest.groups,
    extra: { paths: ['todos[id=selected].text'], chunk: 'binding=draft', bindings: [], covers: [] },
  };
  return { ...result, manifest: { ...result.manifest, groups } };
}

/** Gives each task chunk its own copy of `./api.ts`, since a shared module would be a second chunk. */
function compileInline(source: string, id: string): CompileResult {
  const result = compileFixture(source, id);
  const client = result.client.map((module) => ({
    ...module,
    code: module.code.replace(/import \{ (\w+) \} from '\.\/api\.ts';/, 'const $1 = () => 1;'),
  }));
  return { ...result, client };
}

/** Builds the fixture module with the real loader, and returns the text of the client files. */
async function buildClient(name: string, compile?: CompileFn): Promise<string> {
  return Object.values(await buildFiles(name, compile)).join('');
}

/** Builds the fixture module with the real loader, and returns the client files by name. */
async function buildFiles(name: string, compile?: CompileFn): Promise<Record<string, string>> {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'idlip-features-')));
  try {
    mkdirSync(path.join(root, 'src'));
    const folder = path.join(FIXTURES, name);
    for (const file of readdirSync(folder)) {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        copyFileSync(path.join(folder, file), path.join(root, 'src', file));
      }
    }
    writeFileSync(
      path.join(root, 'src/entry-server.js'),
      'export function render() { return ""; }\n',
    );
    const checked = createCheckedCompile(root).compile;
    const config = createConfig(root, { compile: compile ?? checked, client: LOADER });
    // The real loader, not the stub the fixture app aliases.
    config.resolve = {};
    const builder = await createBuilder(config);
    await builder.buildApp();
    const assets = path.join(root, 'dist/client/assets');
    const files: Record<string, string> = {};
    for (const file of readdirSync(assets)) {
      files[file] = readFileSync(path.join(assets, file), 'utf8');
    }
    return files;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('feature detection', () => {
  it('turns a flag on when a module reports it', () => {
    expect([...getFeatures([compileFixture('', '/src/todo.tsx')])]).toEqual([]);
    expect([...getFeatures([compileFixture('', '/src/effects.tsx')])]).toEqual(['TASKS']);
    expect([...getFeatures([compileKeyed('', '/src/todo.tsx')])]).toEqual(['KEYED']);
  });

  it('turns DYNAMIC on when a manifest has the dynamic group', () => {
    const source = readFileSync(path.join(FIXTURES, 'dynamic/dynamic.tsx'), 'utf8');
    expect([...getFeatures([compileSource(source, '/src/dynamic.tsx')])]).toEqual(['DYNAMIC']);
  });

  it('turns KEY_FN on for a computed key, also in a child component, and not for a field key', () => {
    const list = (key: string): string => `
      import { For } from 'idlip';
      export default function App() {
        let items = [{ id: 1, kind: 'a' }];
        return <ul><For each={items} key={${key}}>{(t) => <li>{t.kind}</li>}</For></ul>;
      }
    `;
    const field = compileSource(list('(t) => t.id'), '/src/app.tsx');
    const template = compileSource(list('(t) => `${t.kind}:${t.id}`'), '/src/app.tsx');
    expect([...getFeatures([field])]).not.toContain('KEY_FN');
    expect([...getFeatures([template])]).toContain('KEY_FN');
    // The computed list is in a component the default export renders, not in the main one.
    const child = compileSource(
      `
      import { For } from 'idlip';
      export default function App() {
        let open = true;
        function toggle() { open = !open; }
        return <main><button on:click={toggle}>x</button><Board /></main>;
      }
      function Board() {
        let items = [{ id: 1, kind: 'a' }];
        function more() { items = [...items, { id: 2, kind: 'b' }]; }
        return <ul><button on:click={more}>m</button><For each={items} key={(t) => \`\${t.kind}:\${t.id}\`}>{(t) => <li>{t.kind}</li>}</For></ul>;
      }
    `,
      '/src/app.tsx',
    );
    expect(child.components).toBeDefined();
    expect([...getFeatures([child])]).toContain('KEY_FN');
  });

  it('turns CHILDREN on for a child module and for a module with children', () => {
    const todo = compileFixture('', '/src/todo.tsx');
    const child = { ...todo, manifest: { ...todo.manifest, view: { chunk: 'view' } } };
    const parent = { ...todo, server: `${todo.server}\nexport const uses = [Counter];` };
    expect([...getFeatures([child])]).toEqual(['CHILDREN']);
    expect([...getFeatures([parent])]).toEqual(['CHILDREN']);
  });

  it('unions the modules of an app', () => {
    const on = getFeatures([
      compileFixture('', '/src/effects.tsx'),
      compileKeyed('', '/src/todo.tsx'),
    ]);
    expect([...on].toSorted()).toEqual(['KEYED', 'TASKS']);
  });

  it('replaces the globals and leaves other code alone', () => {
    const defines = getDefines(new Set(['TASKS']));
    expect(replaceFeatures('a(__IDLIP_HAS_TASKS__, __IDLIP_HAS_KEYED__)', defines)).toEqual({
      code: 'a(true, false)',
      map: null,
    });
    expect(replaceFeatures('a(1)', defines)).toBeUndefined();
  });
});

describe('feature flags in the client build', () => {
  it('drops the task runner and the keyed diff from an app that uses neither', async () => {
    const text = await buildClient('todo');
    expect(text).not.toContain(TASK_CODE);
    expect(text).not.toContain(KEYED_CODE);
  }, 60_000);

  it('drops the slot table from an app without children', async () => {
    const text = await buildClient('todo');
    // The slot table is the only code that writes the kind of a slot.
    expect(text).not.toContain('kind: "removed"');
  }, 60_000);

  it('keeps the task runner of an app with an await handler', async () => {
    const text = await buildClient('effects', compileInline);
    expect(text).toContain(TASK_CODE);
    expect(text).not.toContain(KEYED_CODE);
  }, 60_000);

  it('keeps the keyed diff of an app with a keyed path', async () => {
    const text = await buildClient('todo', compileKeyed);
    expect(text).toContain(KEYED_CODE);
    expect(text).not.toContain(TASK_CODE);
  }, 60_000);

  it('drops the dynamic holes from an app without one and keeps them in an app with one', async () => {
    expect(await buildClient('todo')).not.toContain(DYNAMIC_CODE);
    expect(await buildClient('dynamic', compileSource)).toContain(DYNAMIC_CODE);
  }, 60_000);
});
