// The work of the REPL worker for one request, apart from the worker's message listener so the
// tests can run it.
import type { FromWorker, ToWorker } from './protocol.ts';
import { renderProject } from './render.ts';

/** The render function, so the tests can give a fake one. */
export type Render = typeof renderProject;

function getMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Renders one request. Each request keeps its own module URLs: renders of two live samples can
 * run at once, so one render must not revoke the modules another is still loading. `post` sends
 * each URL to the page as it is made, so the page can revoke it if it ends the worker.
 */
export async function answerRequest(
  request: ToWorker,
  post: (message: FromWorker) => void,
  render: Render = renderProject,
): Promise<FromWorker> {
  const blobs: string[] = [];
  function createBlobUrl(code: string): string {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    blobs.push(url);
    post({ kind: 'blob', id: request.id, url });
    return url;
  }
  try {
    const rendered = await render(request.project, request.chunks, request.folder, createBlobUrl);
    return { kind: 'rendered', id: request.id, rendered };
  } catch (error) {
    return { kind: 'failed', id: request.id, message: getMessage(error) };
  } finally {
    // The render has loaded every module it imports, so the URLs can go.
    for (const url of blobs) {
      URL.revokeObjectURL(url);
    }
  }
}
