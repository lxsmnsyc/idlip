import { render as renderComponent, renderListener } from 'idlip/server';
import App from './app.idlip.tsx';

export function todos(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: String(i + 1),
    title: `Todo number ${i + 1}`,
    done: i % 3 === 0,
  }));
}

/**
 * Renders the page with `n` todos. `loader` is the URL of the built loader module.
 */
export async function page(n: number, loader: string): Promise<string> {
  const body = await renderComponent(App, { initial: todos(n) });
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>bench</title>` +
    renderListener() +
    `<script type="module" async src="${loader}"></script>` +
    `</head><body>${body}</body></html>`
  );
}
