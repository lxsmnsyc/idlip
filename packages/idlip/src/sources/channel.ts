export interface Sink<T> {
  push(value: T): void;
  fail(error: unknown): void;
  end(): void;
}

interface State {
  wake: (() => void) | undefined;
  ended: boolean;
  failed: boolean;
  failure: unknown;
}

/**
 * Turns callbacks into an async generator with a bounded buffer. When the buffer is
 * full, the oldest value goes. The generator ends within one task after the signal
 * aborts, even when nobody awaits `return()`.
 */
export async function* listen<T>(
  signal: AbortSignal,
  capacity: number,
  start: (sink: Sink<T>) => () => void,
): AsyncGenerator<T, void, undefined> {
  if (signal.aborted) {
    return;
  }
  const queue: T[] = [];
  const state: State = { wake: undefined, ended: false, failed: false, failure: undefined };
  function notify(): void {
    const resume = state.wake;
    state.wake = undefined;
    resume?.();
  }
  function isAborted(): boolean {
    return signal.aborted;
  }
  const stop = start({
    push(value) {
      queue.push(value);
      if (queue.length > capacity) {
        queue.shift();
      }
      notify();
    },
    fail(error) {
      state.failed = true;
      state.failure = error;
      notify();
    },
    end() {
      state.ended = true;
      notify();
    },
  });
  signal.addEventListener('abort', notify, { once: true });
  try {
    while (!isAborted()) {
      if (queue.length > 0) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        yield queue.shift() as T;
      } else if (state.failed) {
        throw state.failure;
      } else if (state.ended) {
        return;
      } else {
        await new Promise<void>((resolve) => {
          state.wake = resolve;
        });
      }
    }
  } finally {
    signal.removeEventListener('abort', notify);
    stop();
  }
}
