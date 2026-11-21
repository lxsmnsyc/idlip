import { listen } from './channel.ts';

export const SOCKET_BUFFER = 100;

export interface SocketInput {
  url: string;
  protocols?: string | string[];
}

/**
 * Yields the text messages of a WebSocket. The buffer holds 100 messages and drops the
 * oldest. The source ends when the socket closes and throws on a socket error.
 */
export function socket(
  input: string | SocketInput,
  signal: AbortSignal,
): AsyncGenerator<string, void, undefined> {
  return listen<string>(signal, SOCKET_BUFFER, (sink) => {
    const options = typeof input === 'string' ? { url: input } : input;
    const ws = new WebSocket(options.url, options.protocols);
    ws.addEventListener('message', (event) => {
      if (typeof event.data === 'string') {
        sink.push(event.data);
      }
    });
    ws.addEventListener('error', () => {
      sink.fail(new Error(`WebSocket error: ${options.url}`));
    });
    ws.addEventListener('close', () => {
      sink.end();
    });
    return () => {
      ws.close();
    };
  });
}
