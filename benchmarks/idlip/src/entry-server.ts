import { renderToStream } from 'idlip/server';
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
 * `preload` (the default) the head preloads the chunks of the first click. The stream is read to
 * a string, which is what the harness measures.
 */
export async function page(n: number, loader: string, preload = true): Promise<string> {
  const stream = renderToStream(
    App,
    { initial: todos(n) },
    { loader, preload: preload ? {} : false },
  );
  let html = '';
  for await (const chunk of stream) {
    html += chunk;
  }
  return html;
}
