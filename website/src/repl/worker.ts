// The REPL worker: renders the first file of a run on the server side. The code of the files
// runs here, not in the page, so a render that throws or never ends does not stop the page, and
// the page can end the worker. The page compiles: the WebAssembly parser starts its own threads,
// which a worker cannot wait for.
import { answerRequest } from './answer.ts';
import type { FromWorker, ToWorker } from './protocol.ts';

function post(message: FromWorker): void {
  postMessage(message);
}

function isRequest(value: unknown): value is ToWorker {
  return (
    typeof value === 'object' && value !== null && typeof Reflect.get(value, 'id') === 'number'
  );
}

addEventListener('message', (event: MessageEvent<unknown>) => {
  const request = event.data;
  if (isRequest(request)) {
    answerRequest(request, post).then(post, (error: unknown) => {
      post({ kind: 'failed', id: request.id, message: String(error) });
    });
  }
});
