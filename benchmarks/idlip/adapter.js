import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));

export const label = 'idlip';

// The built URL of the loader, the `loader` entry of the client manifest.
async function findLoader() {
  const manifest = JSON.parse(await readFile(`${dir}dist/client/.vite/manifest.json`, 'utf8'));
  for (const item of Object.values(manifest)) {
    if (item.name === 'loader' && item.isEntry) {
      return `/${item.file}`;
    }
  }
  throw new Error('The client manifest has no loader entry.');
}

export async function load() {
  const server = await import(`${dir}dist/server/entry-server.js`);
  const loader = await findLoader();
  return {
    staticDir: `${dir}dist/client`,
    render: (n) => server.page(n, loader),
  };
}
