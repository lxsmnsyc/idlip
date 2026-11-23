import { renderToStream } from 'idlip/server';
import Dashboard from './widgets/Dashboard.tsx';

/**
 * Renders the dashboard page. `loader` is the URL of the built loader module. With `preload`
 * (the default) the head preloads the click chunks of the first widgets: 20 chunks cover the
 * row of 4 widgets above the fold, 5 chunks each. The stream is read to a string, which is what
 * the harness measures.
 */
export async function page(loader: string, preload = true): Promise<string> {
  const stream = renderToStream(Dashboard, {}, { loader, preload: preload ? { max: 20 } : false });
  let html = '';
  for await (const chunk of stream) {
    html += chunk;
  }
  return html;
}
