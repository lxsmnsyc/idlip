import { renderToStream } from 'idlip/server';
import { build } from '../../../harness/rows.mjs';
import App from './app.tsx';

/**
 * Renders the rows page with `n` rows. `loader` is the URL of the built loader module. With
 * `preload` (the default) the head preloads the chunks of the first click. The stream is read to
 * a string, which is what the harness measures.
 */
export async function page(n: number, loader: string, preload = true): Promise<string> {
  const stream = renderToStream(
    App,
    { initial: build(1, n) },
    { loader, preload: preload ? {} : false },
  );
  let html = '';
  for await (const chunk of stream) {
    html += chunk;
  }
  return html;
}
