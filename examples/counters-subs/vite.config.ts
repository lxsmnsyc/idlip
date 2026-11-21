import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { idlip } from 'idlip/vite';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

const root = import.meta.dirname;
const clientDir = path.join(root, 'dist/client');
const serverEntry = path.join(root, 'dist/server/entry-server.js');

interface PageModule {
  render(url: string, options: { loader: string; nonce: string }): Promise<string>;
}

function isPageModule(value: unknown): value is PageModule {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'render') === 'function'
  );
}

/**
 * Returns the built URL of the loader, the `loader` entry of the client manifest.
 */
async function findLoader(): Promise<string> {
  const manifest: unknown = JSON.parse(
    await readFile(path.join(clientDir, '.vite/manifest.json'), 'utf8'),
  );
  if (typeof manifest === 'object' && manifest !== null) {
    for (const item of Object.values(manifest) as unknown[]) {
      if (
        typeof item === 'object' &&
        item !== null &&
        Reflect.get(item, 'name') === 'loader' &&
        Reflect.get(item, 'isEntry') === true
      ) {
        return `/${String(Reflect.get(item, 'file'))}`;
      }
    }
  }
  throw new Error('The client manifest has no loader entry. Run `vite build` first.');
}

function getPolicy(nonce: string): string {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    "base-uri 'none'",
    "object-src 'none'",
    "require-trusted-types-for 'script'",
    'trusted-types idlip',
  ].join('; ');
}

/**
 * Serves `GET /` in `vite preview` with the built server entry, a nonce per request and a
 * strict CSP. `GET /?props=<json>` renders the page for those props.
 */
function servePages(): Plugin {
  return {
    name: 'counters-subs:preview-pages',
    configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.originalUrl ?? request.url ?? '/', 'http://localhost');
        if (request.method !== 'GET' || url.pathname !== '/') {
          next();
          return;
        }
        async function respond(): Promise<void> {
          const loaded: unknown = await import(pathToFileURL(serverEntry).href);
          if (!isPageModule(loaded)) {
            throw new TypeError(`${serverEntry} exports no render(url, options)`);
          }
          const nonce = randomBytes(16).toString('base64');
          const html = await loaded.render(`${url.pathname}${url.search}`, {
            loader: await findLoader(),
            nonce,
          });
          response.statusCode = 200;
          response.setHeader('Content-Type', 'text/html; charset=utf-8');
          response.setHeader('Cache-Control', 'no-store');
          response.setHeader('Content-Security-Policy', getPolicy(nonce));
          response.end(html);
        }
        respond().catch(next);
      });
    },
  };
}

export default defineConfig({
  plugins: [idlip({ entry: '/src/entry-server.ts' }), servePages()],
  // The e2e tests reach the preview at 127.0.0.1, and `localhost` may resolve to `::1` only.
  preview: { host: '127.0.0.1' },
  environments: {
    client: {
      build: {
        manifest: true,
        rolldownOptions: {
          input: { loader: 'idlip/client' },
          // A hash may hold `-`, so a `.` separates it from the chunk name. The e2e tests read
          // chunk names from these file names.
          output: {
            entryFileNames: 'assets/[name].[hash].js',
            chunkFileNames: 'assets/[name].[hash].js',
          },
        },
      },
    },
  },
});
