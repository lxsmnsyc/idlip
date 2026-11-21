// oxlint-disable import/prefer-default-export
import { listen } from './channel.ts';

/**
 * Yields whether the media query matches, the current value first and then each change.
 * A slow reader gets only the latest value.
 */
export function media(
  query: string,
  signal: AbortSignal,
): AsyncGenerator<boolean, void, undefined> {
  return listen<boolean>(signal, 1, (sink) => {
    const list = matchMedia(query);
    function onChange(event: MediaQueryListEvent): void {
      sink.push(event.matches);
    }
    list.addEventListener('change', onChange);
    sink.push(list.matches);
    return () => {
      list.removeEventListener('change', onChange);
    };
  });
}
