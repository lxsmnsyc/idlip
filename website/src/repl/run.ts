// Runs the files of the REPL and of edited live samples in the browser. The page compiles them,
// and a worker renders the first one on the server side, so the code of the files never runs in
// the page. The frame then loads the page as a browser loads a built app: the document, the loader
// and, on each event, the chunks it needs. The service worker in `sw.ts` serves those files from
// a cache this module fills, so each one is a real request.
import type { ServedChunk } from './chunks.ts';
import { createRequester } from './requests.ts';
import { createRunner as createRunnerWith } from './runner.ts';
import type { Runner } from './runner.ts';
// Vite gives the URL of each worker bundle as the default export.
// oxlint-disable-next-line import/default
import runtimeUrl from './runtime.ts?worker&url';
// oxlint-disable-next-line import/default
import serviceUrl from './sw.ts?worker&url';

export type { RunResult, Runner } from './runner.ts';

/** The cache that `sw.ts` answers from. */
const CACHE = 'idlip-repl';
/** Runs of other pages older than this are dropped from the cache. */
const RUN_AGE = 60 * 60 * 1000;
/** The header that holds the time a run was stored. */
const TIME_HEADER = 'x-idlip-repl-time';

let scope: Promise<string> | undefined;

/** One worker for the whole page. */
const ask = createRequester(() => {
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  return {
    postMessage: (message) => {
      worker.postMessage(message);
    },
    terminate: () => {
      worker.terminate();
    },
    listen: (onMessage, onError) => {
      worker.addEventListener('message', (event: MessageEvent<unknown>) => {
        onMessage(event.data);
      });
      worker.addEventListener('error', (event) => {
        onError(event.message);
      });
    },
  };
});

async function waitActive(registration: ServiceWorkerRegistration): Promise<void> {
  const installing = registration.installing ?? registration.waiting;
  if (registration.active && !installing) {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    function check(): void {
      if (installing?.state === 'activated') {
        resolve();
      } else if (installing?.state === 'redundant') {
        reject(new Error('The service worker of the REPL stopped while it installed.'));
      }
    }
    installing?.addEventListener('statechange', check);
    check();
  });
}

/** Registers the service worker once and returns the URL of the folder it serves. */
async function startService(): Promise<string> {
  if (!('serviceWorker' in navigator) || !isSecureContext || !('caches' in globalThis)) {
    throw new Error(
      'The REPL serves the run through a service worker, which needs HTTPS or localhost.',
    );
  }
  const script = new URL(serviceUrl, location.href);
  const folder = new URL('./repl-run/', script).href;
  const registration = await navigator.serviceWorker.register(script, {
    type: 'module',
    scope: folder,
  });
  await waitActive(registration);
  return folder;
}

/**
 * Puts the files of a run in the cache. Drops the older runs of this page, and the runs of
 * other pages stored over an hour ago, so the cache does not grow without end. Runs of other
 * open pages stay, so two tabs do not break each other.
 */
async function storeRun(
  own: string,
  folder: string,
  document: string,
  chunks: readonly ServedChunk[],
): Promise<void> {
  const cache = await caches.open(CACHE);
  const now = Date.now();
  for (const request of await cache.keys()) {
    if (request.url.startsWith(own)) {
      if (!request.url.startsWith(folder)) {
        await cache.delete(request);
      }
      continue;
    }
    const stored = Number((await cache.match(request))?.headers.get(TIME_HEADER));
    if (!(stored > now - RUN_AGE)) {
      await cache.delete(request);
    }
  }
  const headers = { 'cache-control': 'no-store', [TIME_HEADER]: String(now) };
  const writes: Promise<void>[] = [
    cache.put(
      folder,
      new Response(document, {
        headers: { ...headers, 'content-type': 'text/html; charset=utf-8' },
      }),
    ),
  ];
  for (const chunk of chunks) {
    writes.push(
      cache.put(
        `${folder}${chunk.path}`,
        new Response(chunk.code, {
          headers: { ...headers, 'content-type': 'text/javascript; charset=utf-8' },
        }),
      ),
    );
  }
  await Promise.all(writes);
}

/** The service worker, started once. A failed start is tried again on the next run. */
async function serve(): Promise<string> {
  scope ??= startService().catch((error: unknown) => {
    scope = undefined;
    throw error;
  });
  return scope;
}

/** Creates a runner with its own run folder in the cache. */
export function createRunner(): Runner {
  return createRunnerWith({
    serve,
    ask,
    store: storeRun,
    runtime: () => new URL(runtimeUrl, location.href).href,
    createId: () => crypto.randomUUID(),
    createUrl: (code) => URL.createObjectURL(new Blob([code], { type: 'text/javascript' })),
    revokeUrl: (url) => {
      URL.revokeObjectURL(url);
    },
  });
}

/** The runner of the REPL page. */
export const runFiles: Runner = createRunner();
