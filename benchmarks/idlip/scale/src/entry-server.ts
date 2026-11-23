import { renderToResponse } from 'idlip/server';
import Dashboard from './widgets/Dashboard.tsx';

/**
 * Renders the dashboard page. `loader` is the URL of the built loader module.
 */
export async function page(loader: string): Promise<string> {
  const response = await renderToResponse(Dashboard, {}, { loader, preload: false });
  return response.text();
}
