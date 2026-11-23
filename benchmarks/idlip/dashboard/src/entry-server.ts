import { renderToResponse } from 'idlip/server';
import Dashboard from './widgets/Dashboard.tsx';

/**
 * Renders the dashboard page. `loader` is the URL of the built loader module. With `preload`
 * (the default) the head preloads the click chunks of the first widgets: 20 chunks cover the
 * row of 4 widgets above the fold, 5 chunks each.
 */
export async function page(loader: string, preload = true): Promise<string> {
  const response = await renderToResponse(
    Dashboard,
    {},
    { loader, preload: preload ? { max: 20 } : false },
  );
  return response.text();
}
