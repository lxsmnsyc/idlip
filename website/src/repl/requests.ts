// Sends render requests to the REPL worker and matches the answers by id. Several editors share
// one worker: the REPL page, and every live sample of a docs page. A request that takes too long
// ends the worker. Only that request fails, and the others go again to a new worker, each with a
// new time limit. The tests give it a fake worker.
import type { FromWorker, ToWorker } from './protocol.ts';

/** The part of a `Worker` this file uses. */
export interface WorkerLike {
  postMessage: (message: ToWorker) => void;
  terminate: () => void;
  /** Calls `onMessage` with the data of each message, and `onError` when the worker fails. */
  listen: (onMessage: (data: unknown) => void, onError: (message: string) => void) => void;
}

/** An answer of the worker to a request: a render or its error. */
export type Answer = Exclude<FromWorker, { kind: 'blob' }>;

export type Ask = (request: ToWorker, limit?: number) => Promise<Answer>;

interface Waiting {
  request: ToWorker;
  limit: number | undefined;
  timer: ReturnType<typeof setTimeout> | undefined;
  /** The module URLs the worker made for this request, so the page can revoke them. */
  blobs: string[];
  resolve: (answer: Answer) => void;
  reject: (error: Error) => void;
}

function isMessage(value: unknown): value is FromWorker {
  return (
    typeof value === 'object' && value !== null && typeof Reflect.get(value, 'id') === 'number'
  );
}

/** Creates the function that asks the worker. `start` makes a new worker. */
export function createRequester(start: () => WorkerLike): Ask {
  let worker: WorkerLike | undefined;
  const waiting = new Map<number, Waiting>();

  // The URLs a worker made die with it. The page revokes them too, so none stays registered.
  function revokeBlobs(item: Waiting): void {
    for (const url of item.blobs) {
      URL.revokeObjectURL(url);
    }
    item.blobs = [];
  }

  function arm(item: Waiting): void {
    clearTimeout(item.timer);
    item.timer = undefined;
    if (item.limit !== undefined) {
      const limit = item.limit;
      item.timer = setTimeout(() => {
        stopSlow(item.request.id, `The render did not finish in ${limit / 1000} s.`);
      }, limit);
    }
  }

  /** Ends the worker and fails what waits on it. The next request starts a new one. */
  function stopAll(message: string): void {
    worker?.terminate();
    worker = undefined;
    for (const item of waiting.values()) {
      clearTimeout(item.timer);
      revokeBlobs(item);
      item.reject(new Error(message));
    }
    waiting.clear();
  }

  /** Ends the worker for one slow request. The other requests go again, each with a new limit. */
  function stopSlow(id: number, message: string): void {
    worker?.terminate();
    worker = undefined;
    const slow = waiting.get(id);
    waiting.delete(id);
    if (slow !== undefined) {
      revokeBlobs(slow);
      slow.reject(new Error(message));
    }
    if (waiting.size === 0) {
      return;
    }
    const next = getWorker();
    for (const item of waiting.values()) {
      revokeBlobs(item);
      arm(item);
      next.postMessage(item.request);
    }
  }

  function getWorker(): WorkerLike {
    if (worker !== undefined) {
      return worker;
    }
    const started = start();
    started.listen(
      (message) => {
        onMessage(started, message);
      },
      (message) => {
        if (started === worker) {
          stopAll(`The REPL worker failed: ${message}`);
        }
      },
    );
    worker = started;
    return started;
  }

  function onMessage(from: WorkerLike, message: unknown): void {
    if (from !== worker || !isMessage(message)) {
      return;
    }
    const item = waiting.get(message.id);
    if (item === undefined) {
      return;
    }
    if (message.kind === 'blob') {
      item.blobs.push(message.url);
      return;
    }
    clearTimeout(item.timer);
    // The worker revokes the URLs of a finished render itself.
    item.blobs = [];
    waiting.delete(message.id);
    item.resolve(message);
  }

  return async (request, limit) => {
    const target = getWorker();
    return new Promise((resolve, reject) => {
      const item: Waiting = { request, limit, timer: undefined, blobs: [], resolve, reject };
      waiting.set(request.id, item);
      arm(item);
      target.postMessage(request);
    });
  };
}
