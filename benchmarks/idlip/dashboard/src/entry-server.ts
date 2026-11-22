import { renderListener, renderPage, renderPreload } from 'idlip/server';
import Dashboard from './widgets/Dashboard.tsx';

/**
 * Renders the dashboard page. `loader` is the URL of the built loader module. With `preload`
 * (the default) the head preloads the click chunks of the first widgets: 20 chunks cover the
 * row of 4 widgets above the fold, 5 chunks each.
 */
export async function page(loader: string, preload = true): Promise<string> {
  const { body, chunks, manifests } = await renderPage(Dashboard, {});
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>bench</title>` +
    renderListener() +
    (preload ? renderPreload(chunks, manifests, { max: 20 }) : '') +
    `<script type="module" async src="${loader}"></script>` +
    `</head><body>${body}</body></html>`
  );
}
