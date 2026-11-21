---
name: core-api
version: 11
status: frozen
defined_by: core-api
---

# Contract: core-api

## Purpose

The public surface of `idlip`: the runtime values a component imports, the JSX types, and the package layout. A component is a plain function (`docs/proposals/0002-modules.md`), so this contract has no module API, no message types for authors and no compile-time markers. Every runtime and compiler node imports it.

## Interface

```ts
// idlip
// Block components for the proof of concept. The markup DSL replaces them with blocks.
function For<T>(props: { each: readonly T[]; key: keyof T & string; children: (item: T, index: number) => JSX.Element }): JSX.Element;
// Exported as throwing stubs, like `For`. The compiler implements them (`errors`, `document-head`, `commands-subs`).
function Try(props: { catch: (error: unknown, reset: () => void) => JSX.Element; children: JSX.Element | readonly JSX.Element[] }): JSX.Element;
function Head(props: { children: JSX.Element | readonly JSX.Element[] }): JSX.Element;
function Subscribe<I, V>(props: { to: (input: I, signal: AbortSignal) => AsyncIterable<V>; input: I; 'on:value': (value: V) => unknown }): JSX.Element;

// Impure values, awaited in handlers so the log records them. Run in the runtime core.
const Random: { id(): Promise<string>; number(): Promise<number> };
const Time: { now(): Promise<number>; sleep(ms: number, signal?: AbortSignal): Promise<void> };
// Rejects when signal aborts, so a subscription source ends its await on stop.
function until<T>(signal: AbortSignal, promise: Promise<T>): Promise<T>;

// Stock subscription sources, exported from `idlip` with no new subpath. Each is an async generator `(input, signal)`.
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
function socket(input: string | SocketInput, signal: AbortSignal): AsyncGenerator<string, void, undefined>; // text messages, buffer 100
function eventSource(input: string | EventSourceInput, signal: AbortSignal): AsyncGenerator<string, void, undefined>; // data, buffer 100
function media(query: string, signal: AbortSignal): AsyncGenerator<boolean, void, undefined>; // current value first

// Raw HTML. A runtime brand, so a plain string is a type error.
type TrustedHtml = string & { readonly __trusted: unique symbol };
function trusted(html: string): TrustedHtml;

// A ref name is a string literal or a tuple of a literal and the row key. `measure` returns a plain rect, which serializes into the message log.
type RefName = string | readonly [string, string | number];
interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
const Dom: {
  focus(ref: RefName): void;
  scrollIntoView(ref: RefName): void;
  measure(ref: RefName): Promise<Rect | null>; // null, with a warning, when no element has the ref
  reset(ref: RefName): void;
};

// idlip/jsx-runtime
// on:* props take a function of the element's event. The compiler restricts it to a handler,
// an arrow whose body is one handler call, or an arrow whose block body is leading
// `e.preventDefault()` and `e.stopPropagation()` statements and one handler call, optionally
// inside a key test `if (e.key === '<key>')` (rule ids and forms in contracts/view-ir.md).
type EventFor<El extends Element, E extends Event> = E & { readonly currentTarget: El };
type EventProp<El extends Element, E extends Event> = (event: EventFor<El, E>) => unknown;
// Exports the types `JSX`, `EventFor` and `EventProp`, and `IntrinsicElements` filled by `jsx-types`.
// Intrinsic elements: attributes, `class` as a string or a record of booleans, `ref`, `html`, `key`, on:* props.
// Also `<window>` and `<document>`, which take only on:* and latest:* props.
// latest:* props take the same functions as on:* and opt into latest-wins delivery.

// idlip/server, owned by `ssr-render`.
function render<Props>(component: (props: Props) => JSX.Element, props: Props, options?: { nonce?: string }): Promise<string>;
// idlip/server, implemented by `resume-loader`.
// Returns the listener `<script>` tag for the page's `<head>`. It keeps events that fire before the loader runs.
function renderListener(options?: { nonce?: string }): string;
// idlip/server, owned by `document-head`. `head` has the last `<title>` first, then the other elements, then the other titles.
function renderPage<Props>(component: (props: Props) => JSX.Element, props: Props, options?: { nonce?: string }): Promise<{ head: string; body: string }>;
// idlip/server, owned by `prefetch`. Names the handler chunks of the first events and their `bindings`, from the manifests alone, so a 103 Early Hint can send them before the page renders.
interface PreloadOptions {
  events?: readonly string[]; // most likely first, default ['click']
  max?: number; // default 8
  format?: 'link' | 'header'; // default 'link'
  nonce?: string; // on each <link>
  crossorigin?: 'anonymous' | 'use-credentials';
}
function renderPreload(chunks: ChunkUrls, manifest: Manifest | readonly Manifest[], options?: PreloadOptions): string;
// idlip/server, used by generated code. A bound URL attribute is wrapped in it.
function safeUrl(value: unknown, name: string, embed?: boolean): unknown; // the value, or undefined for an unsafe URL, so the attribute is left out
```

Internal types shared by the compiler and the runtime (`Message` as `{ t, p }`, manifest, chunk shapes) live in `packages/idlip/src/core/format.ts` and belong to `contracts/compiled-format.md`. They are not exported from `idlip`.

Subpaths: `idlip`, `idlip/server`, `idlip/client`, `idlip/compiler`, `idlip/vite`, `idlip/jsx-runtime`.

## Behavior

- A module file is `*.idlip.tsx` and exports function components. The default export is the file's main component.
- Every export of `idlip` except the block components (`For`, `Try`, `Head`, `Subscribe`) is a runtime value that does what its type says when called. The compiler recognizes the block components by import, and they throw when called at runtime.
- `tsc` checks components as ordinary TypeScript: handler calls in event props, props of child components, the element type of `e.currentTarget`, and `For`'s `key`.
- State types follow the `let` rule of 0002: `let x = v satisfies T as T` for a wider type. The compiler reports `let x: T = v` and a bare `as T`. The type tests show why, with TS2367 on a narrowed `let`.
- A model value that does not serialize is reported at compile time when it is a function, and at server render through seroval otherwise, with the model path. `File` and `Blob` are client-only (`docs/proposals/0004-effects-refs-errors.md`, Files).
- Every stock source ends within one task after abort, with `return()` not awaited, and closes its handle. `socket` and `eventSource` skip non-text messages. `socket` ends when the socket closes and throws on a socket error. `eventSource` throws when the stream closes on an error, and the browser reconnects otherwise. `media` and `timer` keep only the latest value.
- A page puts `renderListener()` in `<head>`, before any markup from `render()`.
- A ref name in a `Dom` call is resolved to the element in the current DOM when the call runs. In a compiled handler, `focus`, `scrollIntoView` and `reset` must be statements of their own (rule `dom-call-position`) and run once after the batch's patch, so an element the same message adds is found. Called outside a handler they act on `document` at once. `reset` resets a form, or sets a field back to its default value.
- `renderPreload` reads `Manifest.listens`. For each event in order, each manifest in order and each handler name in sorted order it names the handler chunk and then the chunks of the handler's `bindings`, until `max`. `link` returns `<link rel="modulepreload">` tags, `header` a `Link` header value. The loader imports the same URLs, so the first click makes no request.
- URL attributes: the compiler wraps a bound value of `href`, `src`, `action`, `formaction`, `poster`, `data`, `cite`, `ping`, `xlink:href` and the other URL attributes in `safeUrl`, which drops `javascript:` and `vbscript:` URLs (`data:` too in `iframe src`, `embed src` and `object data`, except a raster image, and in the `to`, `from`, `by` and `values` of an SVG `<animate>` or `<set>` that animates a URL attribute). A static value in source is not wrapped. Raw HTML goes through `trusted` only.

## Stub

Done by `core-api`: the old exports and `test/messages.test.ts` are deleted, and `Message` is in `src/core/format.ts`.

## Contract tests

`packages/idlip/test/core/`.

## Reserved

- None.

## Open questions

- None for this contract. Design questions live in 0002 and 0004.

## Changes

- v11 (2026-11-21, curator pass after wave 8; `core-api-dom`, `core-api-preload` and the one-shot run): `Dom` is exported with `Rect` and a nullable `measure`, `dom-call-position`; `renderPreload`, `PreloadOptions` and `Manifest.listens`; `renderPage`; `safeUrl` and the URL attribute rules; `trusted` for raw HTML; form fields are plain event paths (nothing to reserve).
- v10 (2026-11-21, `contracts/core-api-sources.change-request.md`, from `stock-sources`): `timer`, `socket`, `eventSource`, `media`, `SocketInput` and `EventSourceInput`. `Random`, `Time` and `until` are exported from `idlip`.
- v9 (2026-11-21, `contracts/core-api.change-request.md`, from `compiled-format`): `renderListener` in `idlip/server`; event props may be block-bodied arrows for modifiers.
- v8 (2026-11-21, found in the `jsx-types` review): `Try` and `Head` take one child or several. A head with a title and a meta tag, or a boundary around siblings, failed with TS2746.
- v7 (frozen 2026-11-21 by `core-api` and `spike-view-analysis`): `For` children take `(item, index)`. `Try`, `Head` and `Subscribe` are exported as throwing stubs. `Random`, `Time`, `until` and `Dom` are not exported until their nodes. `jsx-runtime` exports `JSX`, `EventFor` and `EventProp`. The stub is removed.
- v6 (amended 2026-11-21 by the subscriptions debate): `until`, `Time.sleep` with a signal, `latest:` props.
- v6: function components replace `defineModule`. Block components `Try`, `Head` and `Subscribe`, the `<window>` and `<document>` elements, and `Random` and `Time`. Removes `defineModule`, the `Msg` types, `Handlers`, `ModelOf`, `MsgOf`, `Cmd`, `cmd`, `Sub`, `Result`, `task`, `defineSub`, `ref()` and the `event` placeholder. Event props take functions of the element's event. Adds `render` as a reserved signature. Source: `docs/proposals/0002-modules.md` and `docs/proposals/0004-effects-refs-errors.md`, revised 2026-11-21.
- v5: messages declared first as `Msg`; commands take constructors by value; `Result<T>`; `task` returns a function. Source: 0002 and 0004, 2026-11-20.
- v4: reserves `task`, `defineSub`, `ref`, `trusted`, and the `catch` and `head` module properties. Source: `docs/proposals/0004-effects-refs-errors.md`.
- v3: reserves `event.form` and the `Dom` commands. Source: `docs/proposals/0003-update-analysis.md`.
- v2: `defineModule` with one default export replaces `defineMessages` and `defineUpdate`. Source: `docs/proposals/0002-modules.md`.
- v1: initial draft.
