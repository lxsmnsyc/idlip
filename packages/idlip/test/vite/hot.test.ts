import {
  globSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createBuilder, createServer } from 'vite';
import type { InlineConfig, Plugin, ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { compile } from '../../src/compiler/index.ts';
import type { HotMessage } from '../../src/client/hot.ts';
import { classifyEdit } from '../../src/vite/hot.ts';
import { createConfig } from './app.ts';

const PACKAGE = path.resolve(import.meta.dirname, '../..');
const CLIENT = path.join(PACKAGE, 'src/client/index.ts');
const COUNTER = readFileSync(path.join(PACKAGE, 'test/fixtures/counter/counter.tsx'), 'utf8');
const ENTRY = `import { render as renderComponent, renderListener } from 'idlip/server';
import Counter from './counter.tsx';

export async function render() {
  const { body } = await renderComponent(Counter, { start: 4 });
  return '<!doctype html><html><head>' + renderListener() + '</head><body>' + body + '</body></html>';
}
`;
const HANDLER = '/src/counter.tsx?idlip-handler=increment&lang.js';

function createCounterApp(): string {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'idlip-hot-')));
  mkdirSync(path.join(root, 'src'));
  writeFileSync(path.join(root, 'src/counter.tsx'), COUNTER);
  writeFileSync(path.join(root, 'src/entry-server.js'), ENTRY);
  return root;
}

function createAppConfig(root: string): InlineConfig {
  const config = createConfig(root, { compile, client: CLIENT });
  return {
    ...config,
    resolve: {
      alias: { 'idlip/client': CLIENT, 'idlip/server': path.join(PACKAGE, 'src/server/index.ts') },
    },
  };
}

describe('classifyEdit', () => {
  const before = compile(COUNTER, '/src/counter.tsx');

  it('swaps the chunks whose code changed', () => {
    const edited = compile(COUNTER.replace('count + 1', 'count + 2'), '/src/counter.tsx');
    const message = classifyEdit(before, edited, '/', 7);
    expect(message?.kind).toBe('swap');
    expect(message?.chunks).toEqual([HANDLER]);
  });

  it('remounts when the markup changes', () => {
    const edited = compile(COUNTER.replace('+1</button>', '+one</button>'), '/src/counter.tsx');
    const message = classifyEdit(before, edited, '/', 7);
    expect(message?.kind).toBe('remount');
    expect(message?.chunks.length).toBeGreaterThan(1);
  });

  it('remounts when a handler is removed', () => {
    const source = COUNTER.replace('      <button on:click={reset}>Reset</button>\n', '').replace(
      /  function reset\(\) \{[^}]*\}\n/,
      '',
    );
    const edited = compile(source, '/src/counter.tsx');
    expect(Object.keys(edited.manifest.handlers)).not.toContain('reset');
    const message = classifyEdit(before, edited, '/', 7);
    expect(message?.kind).toBe('remount');
    expect(message?.chunks.some((url) => url.includes('reset'))).toBe(false);
  });

  it('sends nothing when no chunk changed', () => {
    const edited = compile(`// note\n${COUNTER}`, '/src/counter.tsx');
    expect(classifyEdit(before, edited, '/', 7)).toBeUndefined();
  });

  it('remounts a module it has not seen', () => {
    expect(classifyEdit(undefined, before, '/', 7)?.kind).toBe('remount');
  });
});

describe('vite dev hot updates', () => {
  let root = '';
  let vite: ViteDevServer | undefined;
  let http: Server | undefined;
  let origin = '';

  beforeAll(async () => {
    root = createCounterApp();
    const config = createAppConfig(root);
    vite = await createServer({
      ...config,
      server: { ...config.server, middlewareMode: true, hmr: false, ws: false, watch: null },
    });
    http = createHttpServer(vite.middlewares);
    await new Promise<void>((resolve) => {
      http?.listen(0, '127.0.0.1', resolve);
    });
    const address = http.address();
    origin = `http://127.0.0.1:${typeof address === 'object' && address !== null ? address.port : 0}`;
  }, 60_000);

  afterAll(async () => {
    http?.close();
    await vite?.close();
    rmSync(root, { recursive: true, force: true });
  });

  /** Writes the source, runs the plugin's `hotUpdate` and returns what it sent to the page. */
  async function edit(source: string): Promise<unknown> {
    if (vite === undefined) {
      throw new Error('The dev server did not start');
    }
    const client = vite.environments.client;
    const file = path.join(root, 'src/counter.tsx');
    writeFileSync(file, source);
    vite.environments.ssr.moduleGraph.onFileChange(file);
    const modules = [...(client.moduleGraph.getModulesByFile(file) ?? [])];
    const send = vi.spyOn(client.hot, 'send').mockImplementation(() => {});
    let hook: Plugin['hotUpdate'];
    for (const plugin of vite.config.plugins) {
      if (plugin.name === 'idlip') {
        hook = plugin.hotUpdate;
      }
    }
    const handler = typeof hook === 'function' ? hook : hook?.handler;
    await Reflect.apply(handler ?? (() => undefined), { environment: client }, [
      { type: 'update', file, timestamp: 1700000000000, modules, read: () => source, server: vite },
    ]);
    const sent: unknown = send.mock.calls[0]?.[0];
    send.mockRestore();
    return sent;
  }

  async function get(url: string, accept = '*/*'): Promise<string> {
    return (await fetch(origin + url, { headers: { accept } })).text();
  }

  it('swaps an edited handler, and serves its new code', async () => {
    expect(await get('/', 'text/html')).toContain('<output');
    expect(await get(HANDLER)).toContain('+ 1');
    const sent = await edit(COUNTER.replace('count + 1', 'count + 5'));
    const data: HotMessage = {
      module: '/src/counter.tsx',
      kind: 'swap',
      chunks: [HANDLER],
      timestamp: 1700000000000,
    };
    expect(sent).toEqual({ type: 'custom', event: 'idlip:hot', data });
    expect(await get(`${HANDLER}&t=1700000000000`)).toContain('+ 5');
  });

  it('remounts an edit of the markup, and renders it on the server', async () => {
    const sent = await edit(COUNTER.replace('>Reset<', '>Start over<'));
    expect(sent).toMatchObject({ type: 'custom', event: 'idlip:hot', data: { kind: 'remount' } });
    expect(await get('/', 'text/html')).toContain('Start over');
  });

  it('reloads the page when the module does not compile', async () => {
    const sent = await edit('export default function (');
    expect(sent).toEqual({ type: 'full-reload' });
  });
});

describe('production build', () => {
  it('has no hot code in the output', async () => {
    const root = createCounterApp();
    try {
      const builder = await createBuilder(createAppConfig(root));
      await builder.buildApp();
      const files = globSync('dist/**/*.js', { cwd: root });
      expect(files.length).toBeGreaterThan(0);
      for (const name of files) {
        expect(readFileSync(path.join(root, name), 'utf8')).not.toContain('idlip:hot');
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60_000);
});
