import { renderToResponse } from 'idlip/server';
import { build } from '../../../harness/rows.mjs';
import App from './app.tsx';

/**
 * Renders the rows page with `n` rows. `loader` is the URL of the built loader module. With
 * `preload` (the default) the head preloads the chunks of the first click.
 */
export async function page(n: number, loader: string, preload = true): Promise<string> {
  const response = await renderToResponse(
    App,
    { initial: build(1, n) },
    { loader, preload: preload ? {} : false },
  );
  return response.text();
}
