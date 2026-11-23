import { rmSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { createServer, isRunnableDevEnvironment } from 'vite';
import type { Plugin } from 'vite';
import { describe, expect, it } from 'vitest';
import { createApp, createConfig } from './app.ts';

/** A plugin with the name that Nitro's Vite integration registers. */
const FAKE_NITRO: Plugin = { name: 'nitro:main' };

interface Dev {
  origin: string;
  root: string;
  close: () => Promise<void>;
  read: (module: string) => Promise<unknown>;
}

/** Starts a dev server of the fixture app, with the plugins and the idlip options given. */
async function startDev(extra: { plugins?: Plugin[] }): Promise<Dev> {
  const root = createApp();
  const config = createConfig(root);
  const vite = await createServer({
    ...config,
    plugins: [...(extra.plugins ?? []), ...(config.plugins ?? [])],
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
  return {
    origin: `http://127.0.0.1:${address.port}`,
    root,
    async close() {
      http.close();
      await vite.close();
      rmSync(root, { recursive: true, force: true });
    },
    async read(module) {
      const environment = vite.environments.ssr;
      if (!isRunnableDevEnvironment(environment)) {
        throw new Error('The ssr environment cannot run modules');
      }
      const loaded: unknown = await environment.runner.import(module);
      return loaded;
    },
  };
}

describe('the dev middleware of the plugin', () => {
  it('calls the fetch of the default export of the entry', async () => {
    const dev = await startDev({});
    try {
      const response = await fetch(`${dev.origin}/`, { headers: { accept: 'text/html' } });
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8');
      expect(await response.text()).toContain('<main><form');
      // A request that does not ask for HTML is not a page.
      const other = await fetch(`${dev.origin}/`, { headers: { accept: 'application/json' } });
      expect(await other.text()).not.toContain('<main><form');
    } finally {
      await dev.close();
    }
  }, 60_000);

  it('stands aside when the config has Nitro', async () => {
    const dev = await startDev({ plugins: [FAKE_NITRO] });
    try {
      const response = await fetch(`${dev.origin}/`, { headers: { accept: 'text/html' } });
      expect(await response.text()).not.toContain('<main><form');
      // The proxy of the dev loader stays: Nitro does not serve it.
      const loader = await fetch(`${dev.origin}/@id/idlip/client`);
      expect(loader.status).toBe(200);
    } finally {
      await dev.close();
    }
  }, 60_000);

  it('gives the server module the dev loader URL', async () => {
    const dev = await startDev({ plugins: [FAKE_NITRO] });
    try {
      const module = await dev.read('/src/todo.tsx');
      const chunks: unknown = Reflect.get(Object(module), 'chunks');
      expect(Reflect.get(Object(chunks), 'loader')).toBe('/@id/idlip/client');
    } finally {
      await dev.close();
    }
  }, 60_000);

  it('imports the dev server client with the loader, with no markup for it', async () => {
    const dev = await startDev({});
    try {
      const code = await (await fetch(`${dev.origin}/@id/idlip/client`)).text();
      expect(code).toContain('/@vite/client');
      const page = await (
        await fetch(`${dev.origin}/`, { headers: { accept: 'text/html' } })
      ).text();
      expect(page).not.toContain('/@vite/client');
    } finally {
      await dev.close();
    }
  }, 60_000);
});
