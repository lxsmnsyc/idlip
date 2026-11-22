// Runs the files of the REPL. This page compiles them, and a worker renders the first one on the
// server side, so the code of the files never runs in this page. The frame then loads the page as a browser loads a built app: the document, the loader
// and, on each event, the chunks it needs. The service worker in `sw.ts` serves those files from
// a cache this module fills, so each one is a real request.
import { renderListener } from 'idlip/server';
import { listChunks, writeFrameShim } from './chunks.ts';
import type { ServedChunk } from './chunks.ts';
import type { ReplFile } from './files.ts';
import { compileProject } from './project.ts';
import type { Project } from './project.ts';
import type { FromWorker, ToWorker } from './protocol.ts';
import type { Rendered } from './render.ts';
// Vite gives the URL of each worker bundle as the default export.
// oxlint-disable-next-line import/default
import runtimeUrl from './runtime.ts?worker&url';
// oxlint-disable-next-line import/default
import serviceUrl from './sw.ts?worker&url';

/** The cache that `sw.ts` answers from. */
const CACHE = 'idlip-repl';
/** A render that takes longer is stopped with its worker. */
const RENDER_LIMIT = 5000;
/** Runs of other pages older than this are dropped from the cache. */
const RUN_AGE = 60 * 60 * 1000;
/** The header that holds the time a run was stored. */
const TIME_HEADER = 'x-idlip-repl-time';

export type RunResult =
  /** Compiled only: the reader has not chosen to run it, or a file has an error. */
  | { kind: 'compiled'; project: Project }
  | { kind: 'served'; project: Project; url: string; chunks: ServedChunk[]; rendered: Rendered }
  /** Compiled, but the render or the service worker failed. */
  | { kind: 'failed'; project: Project; message: string };

interface Waiting {
  resolve: (message: FromWorker) => void;
  reject: (error: Error) => void;
}

let worker: Worker | undefined;
let requests = 0;
const waiting = new Map<number, Waiting>();
let scope: Promise<string> | undefined;
let page: string | undefined;
let runs = 0;
let blobs: string[] = [];

/** Ends the worker and fails what waits on it. The next request starts a new one. */
function stopWorker(message: string): void {
  worker?.terminate();
  worker = undefined;
  for (const item of waiting.values()) {
    item.reject(new Error(message));
  }
  waiting.clear();
}

function isAnswer(value: unknown): value is FromWorker {
  return (
    typeof value === 'object' && value !== null && typeof Reflect.get(value, 'id') === 'number'
  );
}

function startWorker(): Worker {
  const started = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  started.addEventListener('message', (event: MessageEvent<unknown>) => {
    const answer = event.data;
    if (isAnswer(answer)) {
      waiting.get(answer.id)?.resolve(answer);
      waiting.delete(answer.id);
    }
  });
  started.addEventListener('error', (event) => {
    stopWorker(`The REPL worker failed: ${event.message}`);
  });
  return started;
}

/** Sends a request to the worker. With `limit`, ends the worker when no answer comes in time. */
async function ask(request: ToWorker, limit?: number): Promise<FromWorker> {
  worker ??= startWorker();
  const target = worker;
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (limit !== undefined) {
      timer = setTimeout(() => {
        stopWorker(`The render did not finish in ${limit / 1000} s.`);
      }, limit);
    }
    waiting.set(request.id, {
      resolve(answer) {
        clearTimeout(timer);
        resolve(answer);
      },
      reject(error) {
        clearTimeout(timer);
        reject(error);
      },
    });
    target.postMessage(request);
  });
}

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

function createBlobUrl(code: string): string {
  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  blobs.push(url);
  return url;
}

/**
 * Reports the errors of the frame to the page: errors, rejections, `console.error` (the loader
 * logs a failed update there) and scripts that fail to load.
 */
function writeBridge(run: number): string {
  return `(function(){var s=function(m){parent.postMessage({idlipRepl:${run},message:String(m&&m.message||m)},'*')};addEventListener('error',function(e){s(e.target!==window&&e.target.src?'Could not load '+e.target.src:e.error||e.message)},true);addEventListener('unhandledrejection',function(e){s(e.reason)});var c=console.error;console.error=function(){c.apply(console,arguments);s(arguments[0])}})()`;
}

function writeDocument(rendered: Rendered, css: string, runtime: string, run: number): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>REPL run ${run}</title><style>${css}</style><script>${writeBridge(run)}</script>${renderListener()}<script type="module" src="${runtime}"></script>${rendered.head}</head><body>${rendered.body}</body></html>`;
}

function getMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

/**
 * Compiles the files. With `render`, and when they compile, renders them in the worker and
 * stores the run for the frame. `css` is the frame's stylesheet.
 */
export async function runFiles(
  files: readonly ReplFile[],
  css: string,
  render: boolean,
): Promise<RunResult> {
  const project = compileProject(files);
  if (!render || !project.ok) {
    return { kind: 'compiled', project };
  }
  try {
    scope ??= startService().catch((error: unknown) => {
      scope = undefined;
      throw error;
    });
    const root = await scope;
    page ??= crypto.randomUUID();
    const own = `${root}${page}/`;
    const run = ++runs;
    const folder = `${own}${run}/`;
    const runtime = new URL(runtimeUrl, location.href).href;
    // The modules of the run before this one: its frame is gone.
    for (const url of blobs) {
      URL.revokeObjectURL(url);
    }
    blobs = [];
    // The chunks read the loader through a blob module, which the panel does not list: an app
    // build has no such file.
    const chunks = listChunks(project, folder, createBlobUrl(writeFrameShim(project)));
    const answer = await ask({ id: ++requests, project, chunks, folder }, RENDER_LIMIT);
    if (answer.kind === 'failed') {
      return { kind: 'failed', project, message: `The server render failed: ${answer.message}` };
    }
    await storeRun(own, folder, writeDocument(answer.rendered, css, runtime, run), chunks);
    return { kind: 'served', project, url: folder, chunks, rendered: answer.rendered };
  } catch (error) {
    return { kind: 'failed', project, message: getMessage(error) };
  }
}
