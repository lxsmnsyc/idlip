import { renderListener, renderPage, renderPreload } from 'idlip/server';
import { build } from '../../../harness/rows.mjs';
import App from './app.tsx';

/**
 * Renders the rows page with `n` rows. `loader` is the URL of the built loader module. With
 * `preload` (the default) the head preloads the chunks of the first click.
 */
export async function page(n: number, loader: string, preload = true): Promise<string> {
  const { body, chunks, manifests } = await renderPage(App, { initial: build(1, n) });
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>bench</title>` +
    // The same stylesheet in every app, so that selecting a row paints it.
    `<style>table{border-collapse:collapse}td{padding:4px 8px;border-top:1px solid #ddd}tr.danger{background:#f2dede}</style>` +
    renderListener() +
    (preload ? renderPreload(chunks, manifests) : '') +
    `<script type="module" async src="${loader}"></script>` +
    `</head><body>${body}</body></html>`
  );
}
