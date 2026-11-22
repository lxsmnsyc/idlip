import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));

export const label = 'idlip';

// The built URL of the loader, the `loader` entry of the client manifest.
async function findLoader(root) {
  const manifest = JSON.parse(await readFile(`${root}dist/client/.vite/manifest.json`, 'utf8'));
  for (const item of Object.values(manifest)) {
    if (item.name === 'loader' && item.isEntry) {
      return `/${item.file}`;
    }
  }
  throw new Error('The client manifest has no loader entry.');
}

export async function load() {
  const server = await import(`${dir}dist/server/entry-server.js`);
  const loader = await findLoader(dir);
  return {
    staticDir: `${dir}dist/client`,
    render: (n) => server.page(n, loader),
  };
}

export async function loadDashboard() {
  const server = await import(`${dir}dashboard/dist/server/entry-server.js`);
  const loader = await findLoader(`${dir}dashboard/`);
  return {
    staticDir: `${dir}dashboard/dist/client`,
    // The page loads a handler chunk on the first click and preloads nothing while idle.
    preloadOption: false,
    render: () => server.page(loader),
  };
}

export async function loadRows() {
  const server = await import(`${dir}rows/dist/server/entry-server.js`);
  const loader = await findLoader(`${dir}rows/`);
  return {
    staticDir: `${dir}rows/dist/client`,
    render: (n) => server.page(n, loader),
  };
}

export async function loadScale() {
  const server = await import(`${dir}scale/dist/server/entry-server.js`);
  const loader = await findLoader(`${dir}scale/`);
  return {
    staticDir: `${dir}scale/dist/client`,
    render: () => server.page(loader),
  };
}
