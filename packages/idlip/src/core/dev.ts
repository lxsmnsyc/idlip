import type { QueuedEvent } from './format.ts';

// Vite replaces `process.env.NODE_ENV` in every module of a client build, dependencies
// included, so a production build folds `DEV` to `false` and drops the code behind it. Do not
// test it through a helper or a string: the bundler folds only this exact form.
/** True in development and in tests, false in a production build. */
export const DEV: boolean = process.env.NODE_ENV !== 'production';

/** The queue depth of one element and event type that warns. */
export const DEEP_QUEUE = 20;

/**
 * Warns, once per burst, when `event` is the `DEEP_QUEUE`th pending event of its element and
 * type. Call it before the event joins `queue`.
 */
export function warnDeepQueue(
  queue: readonly { readonly event: QueuedEvent }[],
  event: QueuedEvent,
): void {
  let depth = 1;
  for (const other of queue) {
    if (other.event.target === event.target && other.event.type === event.type) {
      depth++;
    }
  }
  if (depth === DEEP_QUEUE) {
    // oxlint-disable-next-line no-console
    console.warn(
      `idlip: ${DEEP_QUEUE} "${event.type}" events are waiting for one element. Use latest:${event.type} to keep only the last one.`,
    );
  }
}
