import { renderToStream } from 'idlip/server';
import Dashboard from './widgets/Dashboard.tsx';

/**
 * Renders the dashboard page. `loader` is the URL of the built loader module. The stream is read
 * to a string, which is what the harness measures.
 */
export async function page(loader: string): Promise<string> {
  const stream = renderToStream(Dashboard, {}, { loader, preload: false });
  let html = '';
  for await (const chunk of stream) {
    html += chunk;
  }
  return html;
}
