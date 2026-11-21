function abortError(signal: AbortSignal): Error {
  const reason: unknown = signal.reason;
  return reason instanceof Error ? reason : new Error('Aborted');
}

/**
 * Rejects with the signal's reason when the signal aborts, so a source ends its await on stop.
 */
export async function until<T>(signal: AbortSignal, promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    // An aborted signal rejects at once and leaves the promise alone.
    if (signal.aborted) {
      reject(abortError(signal));
      return;
    }
    function onAbort(): void {
      reject(abortError(signal));
    }
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError(signal));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    function onAbort(): void {
      clearTimeout(timer);
      if (signal) {
        reject(abortError(signal));
      }
    }
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// oxlint-disable-next-line typescript/require-await
async function now(): Promise<number> {
  return Date.now();
}

/**
 * The clock, awaited in handlers so the message log records the values.
 */
export const Time: {
  now(): Promise<number>;
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
} = { now, sleep };
