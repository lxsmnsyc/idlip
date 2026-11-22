import {
  globSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createBuilder, createServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compile } from '../../src/compiler/index.ts';
import { readChunkUrls } from './app.ts';
import { classifyEdit } from '../../src/vite/hot.ts';
import { idlip } from '../../src/vite/index.ts';

const PACKAGE = path.resolve(import.meta.dirname, '../..');
const CLIENT = path.join(PACKAGE, 'src/client/index.ts');
const WIDGETS = readFileSync(path.join(PACKAGE, 'test/fixtures/widgets/widgets.tsx'), 'utf8');

const BOARD = `import type { JSX } from 'idlip/jsx-runtime';
import Dashboard, { Counter } from './widgets.tsx';
export default function Board(props: { items: { id: string; label: string }[] }): JSX.Element {
  return <div><Counter start={7} /><Dashboard items={props.items} /></div>;
}
`;

const ENTRY = `import { render as renderHtml } from 'idlip/server';
import Board from './board.tsx';
import { Counter } from './widgets.tsx';
export function render(): Promise<string> {
  return renderHtml(Board, { items: [{ id: 'a1', label: 'One' }] });
}
export function renderCounter(): Promise<string> {
  return renderHtml(Counter, { start: 3 });
}
`;

function createApp(files: Record<string, string>): string {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'idlip-components-')));
  for (const [name, source] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    writeFileSync(path.join(root, name), source);
  }
  return root;
}

async function build(root: string): Promise<void> {
  const builder = await createBuilder({
    configFile: false,
    root,
    logLevel: 'silent',
    cacheDir: path.join(root, '.vite'),
    resolve: {
      alias: {
        'idlip/client': CLIENT,
        'idlip/server': path.join(PACKAGE, 'src/server/index.ts'),
      },
    },
    ssr: { noExternal: true },
    plugins: [idlip({ entry: '/src/entry-server.ts', client: CLIENT, compile })],
  });
  await builder.buildApp();
}

function isRender(value: unknown): value is () => Promise<string> {
  return typeof value === 'function';
}

describe('a hot edit of a file with several components', () => {
  it('swaps the chunk of the component whose handler changed', () => {
    const before = compile(WIDGETS, '/src/widgets.tsx');
    const after = compile(
      WIDGETS.replace('count = count + 1', 'count = count + 2'),
      '/src/widgets.tsx',
    );
    expect(classifyEdit(before, after, '/', 1)).toEqual({
      module: '/src/widgets.tsx',
      kind: 'swap',
      chunks: ['/src/widgets.tsx?idlip-Counter.handler=increment&lang.js'],
      timestamp: 1,
    });
  });

  it('remounts with the chunks of every component when the markup changes', () => {
    const before = compile(WIDGETS, '/src/widgets.tsx');
    const after = compile(WIDGETS.replace('<output>', '<output class="n">'), '/src/widgets.tsx');
    const message = classifyEdit(before, after, '/', 1);
    expect(message?.kind).toBe('remount');
    expect(message?.chunks).toContain('/src/widgets.tsx?idlip-Row.handler=toggle&lang.js');
    expect(message?.chunks).toContain('/src/widgets.tsx?idlip-handler=rename&lang.js');
  });
});

describe('a file with several components in a build', () => {
  let root = '';

  beforeAll(async () => {
    root = createApp({
      'src/widgets.tsx': WIDGETS,
      'src/board.tsx': BOARD,
      'src/entry-server.ts': ENTRY,
    });
    await build(root);
  }, 60_000);

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('names the chunk files of a named component after it', () => {
    const names = globSync('dist/client/assets/*.js', { cwd: root });
    function count(prefix: string): number {
      let found = 0;
      for (const name of names) {
        if (path.basename(name).startsWith(prefix)) {
          found += 1;
        }
      }
      return found;
    }
    expect(count('widgets.handler.rename')).toBe(1);
    expect(count('widgets.Counter.handler.increment')).toBe(1);
    expect(count('widgets.Counter.view')).toBe(1);
    expect(count('widgets.Row.handler.toggle')).toBe(1);
    expect(count('widgets.Row.view')).toBe(1);
    // The default export renders inside another file, so it has a view chunk too.
    expect(count('widgets.view')).toBe(1);
  });

  it('maps the chunk ids of each component to their files', () => {
    const urls = readChunkUrls(path.join(root, 'dist/.idlip/chunks.json'));
    const counter = urls['/src/widgets.tsx?idlip-Counter.handler=increment&lang.js'];
    expect(counter).toMatch(/^\/assets\/widgets\.Counter\.handler\.increment/);
    const code = readFileSync(path.join(root, 'dist/client', counter), 'utf8');
    expect(code).toContain('as increment');
    expect(urls['/src/widgets.tsx?idlip-handler=rename&lang.js']).toMatch(
      /^\/assets\/widgets\.handler\.rename/,
    );
  });

  it('renders a page whose state names every component and its built chunks', async () => {
    const entry: unknown = await import(
      pathToFileURL(path.join(root, 'dist/server/entry-server.mjs')).href
    );
    const render: unknown = Reflect.get(Object(entry), 'render');
    const renderCounter: unknown = Reflect.get(Object(entry), 'renderCounter');
    if (!isRender(render) || !isRender(renderCounter)) {
      throw new Error('The server entry has no render functions');
    }
    const html = await render();
    expect(html).toContain('<output><!--t0-->7<!--/t--></output>');
    expect(html).toContain('/src/widgets.tsx#Counter');
    expect(html).toContain('/src/widgets.tsx#Row');
    expect(html).toMatch(/\/assets\/widgets\.Counter\.handler\.increment[^"]*\.js/);
    expect(html).toMatch(/\/assets\/widgets\.Row\.handler\.toggle[^"]*\.js/);
    // A named component renders as a page root too.
    const alone = await renderCounter();
    expect(alone).toContain('<output><!--t0-->3<!--/t--></output>');
    expect(alone).toMatch(/\/assets\/widgets\.Counter\.binding\.count[^"]*\.js/);
  });

  it('serves the chunk of a named component in dev, tied to its file', async () => {
    const vite = await createServer({
      configFile: false,
      root,
      logLevel: 'silent',
      cacheDir: path.join(root, '.vite-dev'),
      resolve: {
        alias: {
          'idlip/client': CLIENT,
          'idlip/server': path.join(PACKAGE, 'src/server/index.ts'),
        },
      },
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      plugins: [idlip({ client: CLIENT, compile })],
    });
    try {
      const client = vite.environments.client;
      const result = await client.transformRequest(
        '/src/widgets.tsx?idlip-Counter.handler=increment&lang.js',
      );
      expect(result?.code).toContain('export function increment');
      // An edit of the file reaches the chunk, since its id names the file.
      const modules = client.moduleGraph.getModulesByFile(path.join(root, 'src/widgets.tsx'));
      expect(modules?.size).toBeGreaterThan(0);
      await expect(
        client.transformRequest('/src/widgets.tsx?idlip-Nope.handler=increment&lang.js'),
      ).rejects.toThrow(/component Nope/);
    } finally {
      await vite.close();
    }
  }, 60_000);
});
