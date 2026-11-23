# Change request: core-api, renderToStream and the late chunk hook

From: `render-stream`. Target: the `idlip/server` block of `contracts/core-api.md`, and the Page state section of `contracts/compiled-format.md` for the late chunks.

## Change

1. `idlip/server` exports `renderToStream`, `streamParts` and the type `StreamOptions`:

```ts
function renderToStream<P>(
  component: (props: P) => unknown,
  props: P,
  options?: StreamOptions,
): ReadableStream<string>;
function streamParts(parts: RenderResult, options?: StreamOptions): ReadableStream<string>;

interface StreamOptions extends RenderOptions {
  loader?: string; // URL of the loader module: an async module script in <head>
  preload?: PreloadOptions | false; // renderPreload options; links go in <head>
  head?: string; // markup at the start of <head>; entry-setup removes the need
}
```

2. The chunks, in order. Each is a string. The user chose brumate's split (2026-11-23): the first chunk is the whole first render, since idlip renders synchronously and an early head gains nothing.

| #   | Holds                                                                                                                                                                | Needs a render |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 1   | doctype, `<head>`, `options.head`, listener, loader script, preload links, `<Head>` output, `</head><body>`, markup, state script (+ `</body></html>` if no pending) | yes            |
| 2.. | the pending chunks, one per item of `RenderResult.pending`                                                                                                           | no             |
| n   | `</body></html>`, only when pending chunks exist                                                                                                                     | no             |

The joined stream equals `<!doctype html><html><head>` + `options.head` + `renderListener()` + loader script + `renderPreload(...)` + `page.head` + `</head><body>` + `page.body` + `</body></html>`.

3. **Hook for `stream-model`.** `RenderResult` gets `pending: AsyncIterable<string>`. `renderPage` returns an empty one (the shared `NOTHING_PENDING`, which the stream compares by identity to close in the first chunk). Each item is a complete piece of HTML that belongs inside `<body>` after the state script, such as `<script nonce>(self.$idlip||=[]).push(...)</script>`. The stream reads one item per pull, so a slow reader holds back the next one. When the reader cancels it calls `return()` on the iterator, so `stream-model` stops its pending work in the generator's `finally` (or aborts a signal there). The stream writes `</body></html>` after the last item. `stream-model` fills `pending` in `renderSync` (`server/render.ts`) and defines the content of an item; the stream needs no format change. The listener wraps `self.$idlip.push`, so a pending script that pushes a record reaches it as the state script does. Whether the loader accepts a record after it started is `stream-model`'s to define in the format.

4. `entry-setup`: a component that renders `<html>`, `<head>` and `<body>` replaces the `<!doctype html><html><head>`, `</head><body>` and `</body></html>` wrappers; the chunks stay the same. `StreamOptions.head` is the only option that exists for a string-built document, and it goes when the document is a component.

## Why

`render` and `renderPage` return the whole page as a string and each entry concatenates the document by hand. A stream gives data that resolves later a place to arrive without a format break.
