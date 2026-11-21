/* oxlint-disable -- Spike prototype with its own node_modules and no tsconfig, so the type-aware rules cannot resolve its imports. */
// Runs the dev server without a port: renders the page on the server, requests
// each chunk URL from the client environment, then edits the module to watch
// the hot update. Restores the module and closes the server at the end.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';

const root = import.meta.dirname;
const file = path.join(root, 'src/todo.idlip.tsx');
const source = readFileSync(file, 'utf8');

const server = await createServer({
  root,
  appType: 'custom',
  server: { middlewareMode: true, ws: false },
});

function waitForHotUpdate(): Promise<void> {
  return new Promise((resolve) => {
    server.watcher.once('change', () => setTimeout(resolve, 300));
  });
}

try {
  // Render on the server, which reads the manifest module.
  const entry = await server.ssrLoadModule('/src/entry-server.ts');
  console.log('[dev] render:', entry.render());
  const urls = entry.chunks['src/todo.idlip.tsx'];

  // Request each chunk as the browser would.
  for (const url of [
    ...Object.values(urls.handlers),
    ...Object.values(urls.bindings),
  ] as string[]) {
    const result = await server.environments.client.transformRequest(url);
    console.log(`[dev] GET ${url} -> ${result?.code.length}B`);
  }

  // Change the toggle handler only.
  const changed = waitForHotUpdate();
  writeFileSync(file, source.replace('done: !t.done', 'done: t.done !== true'));
  await changed;

  // Change a helper that the bindings copy.
  const helper = waitForHotUpdate();
  writeFileSync(
    file,
    source.replace('if (!todo.done) left++;', 'if (todo.done === false) left++;'),
  );
  await helper;

  const fresh = await server.ssrLoadModule('/src/entry-server.ts');
  console.log('[dev] module id after edits:', fresh.TodoApp.id);
} finally {
  writeFileSync(file, source);
  await server.close();
}
