import { listen } from './channel.ts';
import { SOCKET_BUFFER } from './socket.ts';

export interface EventSourceInput {
  url: string;
  /** The event name to listen for. Defaults to `message`. */
  event?: string;
}

/**
 * Yields the data of server-sent events. The buffer holds 100 messages and drops the
 * oldest. The source throws when the stream closes on an error.
 */
export function eventSource(
  input: string | EventSourceInput,
  signal: AbortSignal,
): AsyncGenerator<string, void, undefined> {
  return listen<string>(signal, SOCKET_BUFFER, (sink) => {
    const options = typeof input === 'string' ? { url: input } : input;
    const source = new EventSource(options.url);
    source.addEventListener(options.event ?? 'message', (event) => {
      if (event instanceof MessageEvent && typeof event.data === 'string') {
        sink.push(event.data);
      }
    });
    source.addEventListener('error', () => {
      // A closed stream is final. Otherwise the browser reconnects by itself.
      if (source.readyState === EventSource.CLOSED) {
        sink.fail(new Error(`EventSource error: ${options.url}`));
      }
    });
    return () => {
      source.close();
    };
  });
}
