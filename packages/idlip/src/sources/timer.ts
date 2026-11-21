// oxlint-disable import/prefer-default-export
import { listen } from './channel.ts';

/**
 * Yields `Date.now()` every `ms`. A slow reader gets only the latest tick.
 */
export function timer(ms: number, signal: AbortSignal): AsyncGenerator<number, void, undefined> {
  return listen<number>(signal, 1, (sink) => {
    const interval = setInterval(() => {
      sink.push(Date.now());
    }, ms);
    return () => {
      clearInterval(interval);
    };
  });
}
