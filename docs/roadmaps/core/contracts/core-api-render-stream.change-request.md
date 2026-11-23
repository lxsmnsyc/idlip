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
}
```

2. The chunks, in order. Each is a string. The user chose brumate's split (2026-11-23): the first chunk is the whole first render, since idlip renders synchronously and an early head gains nothing.

| #   | Holds                                                                                                                                                | Needs a render |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 1   | doctype, `<head>`, listener, loader script, preload links, `<Head>` output, `</head><body>`, markup, state script (+ `</body></html>` if no pending) | yes            |
| 2.. | the pending chunks, one per item of `RenderResult.pending`                                                                                           | no             |
| n   | `</body></html>`, only when pending chunks exist                                                                                                     | no             |

The joined stream equals `<!doctype html><html><head>` + `renderListener()` + loader script + `renderPreload(...)` + `page.head` + `</head><body>` + `page.body` + `</body></html>`.

3. **Hook for `stream-model`.** `RenderResult` gets `pending: AsyncIterable<string>`. `renderPage` returns an empty one (the shared `NOTHING_PENDING`, which the stream compares by identity to close in the first chunk). Each item is a complete piece of HTML that belongs inside `<body>` after the state script, such as `<script nonce>(self.$idlip||=[]).push(...)</script>`. The stream reads one item per pull, so a slow reader holds back the next one. `RenderResult` also gets `readonly signal: AbortSignal` and `abort(reason?)`. When the reader cancels, the stream calls `abort(reason)` first and then `return()` on the iterator without awaiting it, since `return()` of a generator queues behind a `next()` that is still in flight and never settles if that `next()` waits on a promise that never resolves. **`stream-model` must wire every loader behind `pending` to `signal`** so an in-flight `next()` settles on abort. The signal is created on first read, and a signal read after the abort is already aborted. `pending` is single-use: a second `streamParts` on the same result gets an exhausted iterator. The stream writes `</body></html>` after the last item. `stream-model` fills `pending` in `renderSync` (`server/render.ts`) and defines the content of an item; the stream needs no format change. The listener wraps `self.$idlip.push`, so a pending script that pushes a record reaches it as the state script does. Whether the loader accepts a record after it started is `stream-model`'s to define in the format.

4. `entry-setup`: a component that renders `<html>`, `<head>` and `<body>` replaces the `<!doctype html><html><head>`, `</head><body>` and `</body></html>` wrappers; the chunks stay the same. `StreamOptions` has no option for document markup.

## Why

`render` and `renderPage` return the whole page as a string and each entry concatenates the document by hand. A stream gives data that resolves later a place to arrive without a format break.
