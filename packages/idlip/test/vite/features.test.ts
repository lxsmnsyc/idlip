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
import type { CompileResult } from '../../src/core/format.ts';
import { idlip } from '../../src/vite/index.ts';
import { getDefines, getFeatures, replaceFeatures } from '../../src/vite/features.ts';
import { compileFixture, createCheckedCompile, createConfig } from './app.ts';

const PACKAGE = path.resolve(import.meta.dirname, '../..');
const FIXTURES = path.join(PACKAGE, 'test/fixtures');
const LOADER = path.join(PACKAGE, 'src/client/index.ts');
/** Text that only the task runner and the keyed diff hold. */
const TASK_CODE = 'idlip: no task for';
const KEYED_CODE = '\\[(\\w+)=';

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
    let text = '';
    for (const file of readdirSync(assets)) {
      text += readFileSync(path.join(assets, file), 'utf8');
    }
    return text;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('feature detection', () => {
  it('turns a flag on when a module reports it', () => {
    expect([...getFeatures([compileFixture('', '/src/todo.idlip.tsx')])]).toEqual([]);
    expect([...getFeatures([compileFixture('', '/src/effects.idlip.tsx')])]).toEqual(['TASKS']);
    expect([...getFeatures([compileKeyed('', '/src/todo.idlip.tsx')])]).toEqual(['KEYED']);
  });

  it('turns CHILDREN on for a child module and for a module with children', () => {
    const todo = compileFixture('', '/src/todo.idlip.tsx');
    const child = { ...todo, manifest: { ...todo.manifest, view: { chunk: 'view' } } };
    const parent = { ...todo, server: `${todo.server}\nexport const uses = [Counter];` };
    expect([...getFeatures([child])]).toEqual(['CHILDREN']);
    expect([...getFeatures([parent])]).toEqual(['CHILDREN']);
  });

  it('unions the modules of an app', () => {
    const on = getFeatures([
      compileFixture('', '/src/effects.idlip.tsx'),
      compileKeyed('', '/src/todo.idlip.tsx'),
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

describe('feature flags of a module outside `modules`', () => {
  it('fails the build when the module needs a dropped feature', async () => {
    const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'idlip-features-')));
    try {
      mkdirSync(path.join(root, 'src'));
      mkdirSync(path.join(root, 'lib'));
      copyFileSync(
        path.join(FIXTURES, 'todo/todo.idlip.tsx'),
        path.join(root, 'src/todo.idlip.tsx'),
      );
      copyFileSync(
        path.join(FIXTURES, 'effects/effects.idlip.tsx'),
        path.join(root, 'lib/effects.idlip.tsx'),
      );
      // The server entry imports the module that `modules` does not list.
      writeFileSync(
        path.join(root, 'src/entry-server.js'),
        "import '../lib/effects.idlip.tsx';\nexport function render() { return ''; }\n",
      );
      const compile = (source: string, id: string): CompileResult =>
        compileFixture(source, id.replace('/lib/', '/src/'));
      const config = createConfig(root, { compile, client: LOADER });
      config.resolve = {};
      config.plugins = [
        idlip({
          entry: '/src/entry-server.js',
          modules: 'src/todo.idlip.tsx',
          compile,
          client: LOADER,
        }),
      ];
      const builder = await createBuilder(config);
      await expect(builder.buildApp()).rejects.toThrow(/lib\/effects\.idlip\.tsx uses HAS_TASKS/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);
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
});
