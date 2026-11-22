// The REPL worker: renders the first file of a run on the server side. The code of the files
// runs here, not in the REPL page, so a render that throws or never ends does not stop the page,
// and the page can end the worker. The page compiles: the WebAssembly parser starts its own
// threads, which a worker cannot wait for.
import type { FromWorker, ToWorker } from './protocol.ts';
import { renderProject } from './render.ts';

function post(message: FromWorker): void {
  postMessage(message);
}

function getMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRequest(value: unknown): value is ToWorker {
  return (
    typeof value === 'object' && value !== null && typeof Reflect.get(value, 'id') === 'number'
  );
}

async function answer(request: ToWorker): Promise<FromWorker> {
  // Each request keeps its own module URLs. Renders of two live samples can run at once, so one
  // render must not revoke the modules another is still loading.
  const blobs: string[] = [];
  function createBlobUrl(code: string): string {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    blobs.push(url);
    return url;
  }
  try {
    const rendered = await renderProject(
      request.project,
      request.chunks,
      request.folder,
      createBlobUrl,
    );
    return { kind: 'rendered', id: request.id, rendered };
  } finally {
    // The render has loaded every module it imports, so the URLs can go.
    for (const url of blobs) {
      URL.revokeObjectURL(url);
    }
  }
}

addEventListener('message', (event: MessageEvent<unknown>) => {
  const request = event.data;
  if (!isRequest(request)) {
    return;
  }
  answer(request).then(post, (error: unknown) => {
    post({ kind: 'failed', id: request.id, message: getMessage(error) });
  });
});
