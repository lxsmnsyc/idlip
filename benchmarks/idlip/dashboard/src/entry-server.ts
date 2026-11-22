import { render as renderComponent, renderListener } from 'idlip/server';
import Dashboard from './widgets/Dashboard.tsx';

/**
 * Renders the dashboard page. `loader` is the URL of the built loader module.
 */
export async function page(loader: string): Promise<string> {
  const body = await renderComponent(Dashboard, {});
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>bench</title>` +
    renderListener() +
    `<script type="module" async src="${loader}"></script>` +
    `</head><body>${body}</body></html>`
  );
}
