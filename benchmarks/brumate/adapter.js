import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));

export const label = 'brumate 0.8.1';

async function entry(root) {
  const manifest = JSON.parse(await readFile(`${root}/dist/client/.vite/manifest.json`, 'utf8'));
  // The links that a page of `handleRoute` gets from the build: the loader, the core and the
  // bundle of the page's root component. The app has one root.
  const hints = JSON.parse(await readFile(`${root}/dist/client/.brumate/hints.json`, 'utf8'));
  const urls = [...new Set([...hints.all, ...Object.values(hints.bundles).flat()])];
  let links = '';
  for (const url of urls) {
    links += `<link rel="modulepreload" href="${url}">`;
  }
  const scripts = `${links}<script type="module" async src="/${manifest['src/client.ts'].file}"></script>`;
  // The bundles that `render()` needs. The state records name them in `b-load`, which is how
  // the browser loads the code of the page.
  const { chunks, styles, members } = hints;
  return { scripts, bundles: { chunks, styles, members } };
}

export async function load() {
  const server = await import(`${dir}dist/server/server.js`);
  const { scripts, bundles } = await entry(dir);
  return {
    staticDir: `${dir}dist/client`,
    render: (n) => server.page(n, scripts, bundles),
  };
}
