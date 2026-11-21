/**
 * The runtime surface a component imports: the block components, which the
 * compiler replaces, `trusted` for raw HTML, the impure values and the stock
 * subscription sources.
 *
 * `Dom` calls the elements that carry a `ref`.
 */
export { For, Head, Subscribe, Try, trusted } from './core/index.ts';
export type { TrustedHtml } from './core/index.ts';
export { Dom } from './core/dom.ts';
export type { Rect, RefName } from './core/dom.ts';
export { Random } from './core/random.ts';
export { Time, until } from './core/time.ts';
export { eventSource, media, socket, timer } from './sources/index.ts';
export type { EventSourceInput, SocketInput } from './sources/index.ts';
