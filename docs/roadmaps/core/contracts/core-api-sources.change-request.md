# Change request: core-api, stock source names

From: `stock-sources`. Target: the Interface section of `contracts/core-api.md`.

## Change

`Random`, `Time` and `until` are exported from `idlip` as the contract states. Add the stock sources, exported from `idlip` with no new subpath. Each is an async generator `(input, signal)`.

```ts
// idlip
interface SocketInput {
  url: string;
  protocols?: string | string[];
}
interface EventSourceInput {
  url: string;
  event?: string;
}
// Every latest-wins source yields only the newest value to a slow reader.
function timer(ms: number, signal: AbortSignal): AsyncGenerator<number, void, undefined>; // Date.now() per tick
function socket(
  input: string | SocketInput,
  signal: AbortSignal,
): AsyncGenerator<string, void, undefined>; // text messages, buffer 100
function eventSource(
  input: string | EventSourceInput,
  signal: AbortSignal,
): AsyncGenerator<string, void, undefined>; // data, buffer 100
function media(query: string, signal: AbortSignal): AsyncGenerator<boolean, void, undefined>; // current value first
```

Add `EventSourceInput` and `SocketInput` to the exported types.

## Behavior

- Every source ends within one task after abort, with `return()` not awaited, and closes its handle.
- `socket` and `eventSource` skip non-text messages. `socket` ends when the socket closes and throws on a socket error. `eventSource` throws when the stream closes on an error, and the browser reconnects otherwise.
- `media` and `timer` keep only the latest value.

## Why

0004 (Subscriptions) names the stock sources but core-api gives no names or types.
