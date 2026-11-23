// Runs the files of the REPL and of edited live samples in the browser. The page compiles them,
// and a worker renders the first one on the server side, so the code of the files never runs in
// the page. The frame that resumes them is sandboxed without an origin: the runner writes its
// document, chunks included, and the page gives it as `srcdoc`. See `frame-document.ts`.
import { createSandboxedWorker } from './render-host.ts';
import { createRequester } from './requests.ts';
import { createRunner as createRunnerWith } from './runner.ts';
import type { Runner } from './runner.ts';
// Vite gives the URL of each worker bundle as the default export.
// oxlint-disable-next-line import/default
import runtimeUrl from './runtime.ts?worker&url';
// oxlint-disable-next-line import/default
import workerUrl from './worker.ts?worker&url';

export type { RunResult, Runner } from './runner.ts';

/** One worker for the whole page, in a sandboxed frame. See `render-host.ts`. */
const ask = createRequester(() => createSandboxedWorker(loadWorker));

/** The code of the worker bundle, which has no imports. */
async function loadWorker(): Promise<string> {
  const response = await fetch(new URL(workerUrl, location.href));
  if (!response.ok) {
    throw new Error(`The render worker did not load (${response.status}).`);
  }
  return response.text();
}

/** The code of the loader module, read once. A failed read is tried again on the next run. */
let runtimeCode: Promise<string> | undefined;

async function loadRuntime(): Promise<string> {
  runtimeCode ??= fetch(new URL(runtimeUrl, location.href))
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`The loader of the frame did not load (${response.status}).`);
      }
      return response.text();
    })
    .catch((error: unknown) => {
      runtimeCode = undefined;
      throw error;
    });
  return runtimeCode;
}

/** Creates a runner with its own run folder. */
export function createRunner(): Runner {
  return createRunnerWith({
    base: () => new URL('./repl-run/', location.href).href,
    origin: () => location.origin,
    ask,
    loadRuntime,
    createId: () => crypto.randomUUID(),
  });
}

/** The runner of the REPL page. */
export const runFiles: Runner = createRunner();
