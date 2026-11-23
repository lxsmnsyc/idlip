import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseSync } from 'oxc-parser';
import { createBuilder, createServer } from 'vite';
import type { Plugin, ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getChunkFile, getChunkId } from '../../src/core/format.ts';
import type { CompileResult, Module } from '../../src/core/format.ts';
import { listChildren } from '../../src/compiler/index.ts';
import { listChunks, parseChunkId, replaceChunkUrls } from '../../src/vite/chunks.ts';
import {
  compileFixture,
  createApp,
  createCheckedCompile,
  createConfig,
  findCopiedHelpers,
  readChunkUrls,
} from './app.ts';

const FIXTURES = path.resolve(import.meta.dirname, '../fixtures');
const MODULES = ['/src/counter.tsx', '/src/todo.tsx'];

function listExports(code: string): string[] {
  const names: string[] = [];
  for (const item of parseSync('chunk.js', code).module.staticExports) {
    for (const entry of item.entries) {
      if (entry.exportName.name !== null) {
        names.push(entry.exportName.name);
      }
    }
  }
  return names.toSorted();
}

function listImports(code: string): string[] {
  const files: string[] = [];
  for (const item of parseSync('chunk.js', code).module.staticImports) {
    files.push(path.basename(item.moduleRequest.value));
  }
  return files;
}

describe('chunk ids', () => {
  it('splits an id into the file and the chunk name', () => {
    expect(parseChunkId('/a/src/todo.tsx?idlip-binding=todos.*.done&lang.js')).toEqual({
      file: '/a/src/todo.tsx',
      module: '/a/src/todo.tsx',
      chunk: 'binding=todos.*.done',
    });
    // A named component puts its name before the chunk name.
    expect(parseChunkId('/a/src/widgets.tsx?idlip-Counter.binding=a.b&lang.js')).toEqual({
      file: '/a/src/widgets.tsx',
      module: '/a/src/widgets.tsx#Counter',
      chunk: 'binding=a.b',
    });
    expect(getChunkId('/src/widgets.tsx#Counter', 'handler=add')).toBe(
      '/src/widgets.tsx?idlip-Counter.handler=add&lang.js',
    );
    expect(parseChunkId('/src/todo.tsx?idlip-binding=todos.%2A.done&lang.js')?.chunk).toBe(
      'binding=todos.*.done',
    );
    expect(parseChunkId('/src/todo.tsx?idlip-list=3&lang.js')?.chunk).toBe('list=3');
    expect(parseChunkId('/src/todo.tsx')).toBeUndefined();
    expect(parseChunkId('/src/todo.tsx?idlip-handler=toggle&lang.tsx')).toBeUndefined();
  });

  it('lists every chunk of the todo manifest once', () => {
    const { manifest } = compileFixture('', '/src/todo.tsx');
    expect(listChunks(manifest)).toEqual([
      'handler=setDraft',
      'handler=clear',
      'handler=add',
      'handler=toggle',
      'binding=todos.*.done',
      'binding=todos.*.text',
      'binding=draft',
      'binding=todos',
      'list=3',
    ]);
  });

  it('names the view chunk of a child', () => {
    const id = '/src/counter.tsx?idlip-view&lang.js';
    expect(parseChunkId(id)).toEqual({
      file: '/src/counter.tsx',
      module: '/src/counter.tsx',
      chunk: 'view',
    });
    expect(parseChunkId('/src/app.tsx?idlip-Row.view&lang.js')?.module).toBe('/src/app.tsx#Row');
    const { manifest } = compileFixture('', '/src/counter.tsx');
    expect(listChunks({ ...manifest, view: { chunk: 'view' } })).toContain('view');
  });

  it('lists the children a module renders', () => {
    const source = `import Counter from './counter.tsx';
export default function Board() {
  return <main><Counter label="a" /></main>;
}`;
    expect(listChildren(source, '/src/board.tsx')).toEqual(['./counter.tsx']);
    expect(listChildren('export default function A() { return <p />; }', '/src/a.tsx')).toEqual([]);
  });

  it('replaces the chunk URLs of a server module', async () => {
    const { server } = compileFixture('', '/src/counter.tsx');
    const urls: Record<string, string> = {};
    for (const chunk of ['increment', 'add', 'reset']) {
      urls[`/src/counter.tsx?idlip-handler=${chunk}&lang.js`] = `/assets/${chunk}.js`;
    }
    urls['/src/counter.tsx?idlip-binding=count&lang.js'] = '/assets/count.js';
    urls.build = '0123abcd';
    // Another module's chunk in the map stays out of this module's map.
    const code = replaceChunkUrls(server, { ...urls, '/src/x.tsx?idlip-view&lang.js': '/x.js' });
    const url = `data:text/javascript,${encodeURIComponent(code.replace(/^import .*$/m, ''))}`;
    const module: unknown = await import(/* @vite-ignore */ url);
    expect(module).toHaveProperty('chunks', urls);
    expect(() => replaceChunkUrls('export const manifest = {};', urls)).toThrow(/chunks/);
    // Only a generated record `$Name = { manifest, chunks, default: Name }` has its map replaced.
    const author = "const $x = { chunks: { 'a': 'a' } };\n";
    const record = "const $Row = { manifest: {}, chunks: { 'a': 'a' }, default: Row };\n";
    const replaced = replaceChunkUrls(`${author}${record}`, { a: '/assets/a.js' });
    expect(replaced).toContain(author);
    expect(replaced).toContain('"a": "/assets/a.js"');
  });
});

describe('vite build', () => {
  let root = '';
  let calls: string[] = [];

  beforeAll(async () => {
    root = createApp();
    const checked = createCheckedCompile(root);
    calls = checked.calls;
    const builder = await createBuilder(createConfig(root, { compile: checked.compile }));
    await builder.buildApp();
  }, 60_000);

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('compiles each module from its source on disk', () => {
    expect(calls.toSorted()).toEqual(MODULES);
  });

  it('writes the chunk URL map outside the served client folder', () => {
    expect(existsSync(path.join(root, 'dist/.idlip/chunks.json'))).toBe(true);
    expect(existsSync(path.join(root, 'dist/client/.idlip'))).toBe(false);
  });

  it('emits the chunk set the manifests list', () => {
    const client = path.join(root, 'dist/client');
    const urls = readChunkUrls(path.join(root, 'dist/.idlip/chunks.json'));
    const expected: string[] = [];
    for (const module of MODULES) {
      const result = compileFixture('', module);
      const name = path.basename(module, '.tsx');
      for (const chunk of listChunks(result.manifest)) {
        const id = getChunkId(module, chunk);
        expected.push(id);
        expect(Object.hasOwn(urls, id), id).toBe(true);
        const url = urls[id];
        expect(url, id).toMatch(/^\/assets\/.+\.js$/);
        const file = path.join(client, url);
        expect(existsSync(file), id).toBe(true);
        // Each chunk is its own file with the exports of the compiled module.
        const source = readFileSync(
          path.join(FIXTURES, name, 'expected/client', getChunkFile(chunk)),
          'utf8',
        );
        expect(listExports(readFileSync(file, 'utf8')), id).toEqual(listExports(source));
      }
    }
    // The build id (`skew`), the loader URL and the shared helpers module are the keys that are
    // not chunks.
    expect(Object.keys(urls).toSorted()).toEqual(
      [...expected, 'build', 'helpers', 'loader'].toSorted(),
    );
    expect(urls.loader).toMatch(/^\/assets\/.+\.js$/);
    expect(urls.helpers).toMatch(/^\/assets\/_idlip-helpers-[\w-]+\.js$/);
    // Besides the chunks, only the loader (`idlip/client`) and the files it imports statically, which
    // the page loads at boot.
    const assets = path.join(client, 'assets');
    const loaded = new Set<string>();
    const pending: string[] = [];
    for (const file of readdirSync(assets)) {
      if (file.startsWith('client-stub-')) {
        pending.push(file);
      }
    }
    expect(pending).toHaveLength(1);
    for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
      if (!loaded.has(file)) {
        loaded.add(file);
        pending.push(...listImports(readFileSync(path.join(assets, file), 'utf8')));
      }
    }
    // `build.js` is the module the loader imports to read the server's build.
    const chunkUrls = new Set([...Object.values(urls), '/assets/build.js']);
    for (const file of readdirSync(assets)) {
      expect(chunkUrls.has(`/assets/${file}`) || loaded.has(file), file).toBe(true);
    }
  });

  it('declares each runtime helper in one file', () => {
    const assets = path.join(root, 'dist/client/assets');
    expect(findCopiedHelpers(assets)).toEqual([]);
    // The fixture's chunks do use helpers, from the shared module.
    const urls = readChunkUrls(path.join(root, 'dist/.idlip/chunks.json'));
    expect(readFileSync(path.join(root, 'dist/client', urls.helpers), 'utf8')).toContain(
      'function setAttr$(',
    );
  });

  it('writes the built URLs into the server module', async () => {
    const urls = readChunkUrls(path.join(root, 'dist/.idlip/chunks.json'));
    // The temporary root has no package.json, so Vite names the ESM output `.mjs`.
    const entry = pathToFileURL(path.join(root, 'dist/server/entry-server.mjs')).href;
    const server: unknown = await import(/* @vite-ignore */ entry);
    const render: unknown = Reflect.get(Object(server), 'render');
    expect(render).toBeTypeOf('function');
    const page: unknown =
      typeof render === 'function' ? Reflect.apply(render, undefined, ['/']) : '';
    expect(page).toBeTypeOf('string');
    for (const [id, url] of Object.entries(urls)) {
      if (id.startsWith('/src/todo.tsx')) {
        expect(page).toContain(`${JSON.stringify(id)}:${JSON.stringify(url)}`);
      }
    }
    expect(page).not.toContain('/src/counter.tsx');
  });
});

describe('vite build errors', () => {
  it('fails on an error diagnostic with its rule and position', async () => {
    const root = createApp();
    function compileWithError(source: string, id: string): CompileResult {
      return {
        ...compileFixture(source, id),
        server: '',
        client: [],
        diagnostics: [
          {
            rule: 'html-nesting',
            severity: 'error',
            message: 'bad nesting',
            span: { start: 0, end: 1 },
          },
        ],
      };
    }
    try {
      const builder = await createBuilder(createConfig(root, { compile: compileWithError }));
      await expect(builder.buildApp()).rejects.toThrow(/\.tsx:1:1 html-nesting: bad nesting/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);
});

describe('vite build errors', () => {
  it('fails when a chunk imports a module the loader does not import', async () => {
    const root = createApp();
    try {
      // The fixture chunks import their helpers and little else. Every chunk imports the loader's
      // `parseHtml` here, so the stub is shared and the bundler keeps it in a file of its own.
      const checked = createCheckedCompile(root).compile;
      function compile(source: string, id: string): CompileResult {
        const result = checked(source, id);
        const client: Module[] = [];
        for (const module of result.client) {
          const code = `import { parseHtml } from 'idlip/client';\nexport const parse = parseHtml;\n${module.code}`;
          client.push({ ...module, code });
        }
        return { ...result, client };
      }
      const builder = await createBuilder(
        createConfig(root, { client: '/src/empty-loader.js', compile }),
      );
      await expect(builder.buildApp()).rejects.toThrow(
        /\.binding\.[\w.*-]+-[\w-]+\.js imports assets\/client-stub-[\w-]+\.js, which the loader does not import/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);
});

describe('vite build with build.outDir', () => {
  it('puts the client, the server and the URL map under it', async () => {
    const root = createApp();
    try {
      const config = createConfig(root);
      const builder = await createBuilder({ ...config, build: { ...config.build, outDir: 'out' } });
      await builder.buildApp();
      expect(existsSync(path.join(root, 'out/client/assets'))).toBe(true);
      expect(existsSync(path.join(root, 'out/server/entry-server.mjs'))).toBe(true);
      expect(existsSync(path.join(root, 'out/.idlip/chunks.json'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);
});

describe('vite dev', () => {
  let root = '';
  let close: () => Promise<void> = async () => {};
  let origin = '';
  let calls: string[] = [];
  let server: ViteDevServer | undefined;

  beforeAll(async () => {
    root = createApp();
    const checked = createCheckedCompile(root);
    calls = checked.calls;
    const config = createConfig(root, { compile: checked.compile });
    const vite = await createServer({
      ...config,
      server: { ...config.server, middlewareMode: true, hmr: false, ws: false, watch: null },
    });
    const http = createHttpServer(vite.middlewares);
    await new Promise<void>((resolve) => {
      http.listen(0, '127.0.0.1', resolve);
    });
    const address = http.address();
    if (address === null || typeof address === 'string') {
      throw new Error('The test server has no port');
    }
    origin = `http://127.0.0.1:${address.port}`;
    server = vite;
    close = async () => {
      http.close();
      await vite.close();
    };
  }, 60_000);

  afterAll(async () => {
    await close();
    rmSync(root, { recursive: true, force: true });
  });

  it('serves server-rendered HTML for the todo', async () => {
    const response = await fetch(`${origin}/`, { headers: { accept: 'text/html' } });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    const html = await response.text();
    const expected = readFileSync(path.join(FIXTURES, 'todo/expected/page.html'), 'utf8').trim();
    expect(html).toContain(expected);
    // The checked compiler throws when it gets anything but the source on disk.
    expect(calls).toContain('/src/todo.tsx');
  });

  it('serves server-rendered HTML for the counter', async () => {
    const response = await fetch(`${origin}/counter`, { headers: { accept: 'text/html' } });
    const html = await response.text();
    const expected = readFileSync(path.join(FIXTURES, 'counter/expected/page.html'), 'utf8').trim();
    expect(html).toContain(expected);
  });

  it('serves each chunk at its id', async () => {
    const id = getChunkId('/src/todo.tsx', 'binding=todos.*.done');
    const response = await fetch(`${origin}${id}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('javascript');
    const code = await response.text();
    expect(code).toContain('export function a5');
    const missing = await fetch(`${origin}/src/todo.tsx?idlip-handler=nope&lang.js`);
    expect(missing.ok).toBe(false);
  });

  it('keeps the page when a module changes without a change of output', async () => {
    if (server === undefined) {
      throw new Error('The dev server did not start');
    }
    const client = server.environments.client;
    const id = getChunkId('/src/todo.tsx', 'handler=toggle');
    await client.transformRequest(id);
    const file = path.join(root, 'src/todo.tsx');
    const modules = [...(client.moduleGraph.getModulesByFile(file) ?? [])];
    expect(modules.length).toBeGreaterThan(0);
    const send = vi.spyOn(client.hot, 'send').mockImplementation(() => {});
    let hook: Plugin['hotUpdate'];
    for (const plugin of server.config.plugins) {
      if (plugin.name === 'idlip') {
        hook = plugin.hotUpdate;
      }
    }
    const handler = typeof hook === 'function' ? hook : hook?.handler;
    expect(handler).toBeTypeOf('function');
    // The hook reads only `this.environment`.
    const result: unknown = await Reflect.apply(
      handler ?? (() => undefined),
      { environment: client },
      [
        {
          type: 'update',
          file,
          timestamp: Date.now(),
          modules,
          read: () => readFileSync(file, 'utf8'),
          server,
        },
      ],
    );
    expect(result).toEqual([]);
    expect(send).not.toHaveBeenCalled();
    send.mockRestore();
  });
});
