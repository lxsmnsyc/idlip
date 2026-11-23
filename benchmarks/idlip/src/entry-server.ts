import { renderListener, render, renderPreload } from 'idlip/server';
import App from './app.tsx';

export function todos(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: String(i + 1),
    title: `Todo number ${i + 1}`,
    done: i % 3 === 0,
  }));
}

/**
 * Renders the page with `n` todos. `loader` is the URL of the built loader module. With
 * `preload` (the default) the head preloads the chunks of the first click.
 */
export async function page(n: number, loader: string, preload = true): Promise<string> {
  const { body, chunks, manifests } = await render(App, { initial: todos(n) });
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>bench</title>` +
    renderListener() +
    (preload ? renderPreload(chunks, manifests) : '') +
    `<script type="module" async src="${loader}"></script>` +
    `</head><body>${body}</body></html>`
  );
}
