---
title: idlip/server
order: 101
section: Reference
description: Render a document component as a Response or a stream, write the listener script and preload the chunks of the first click.
---

`idlip/server` renders compiled components on the server. Import a `*.tsx` module through the Vite plugin, which gives the server build the compiled server module, then pass its default export to `renderToResponse`.

The root component renders the whole document: `<html>` with one `<head>` and one `<body>`. The server adds the doctype, the listener, the preload links, the loader script and the state script. A root that does not render `<html>` is a `TypeError`.

```ts
import { renderToResponse } from 'idlip/server';
import TodoApp from './todo.tsx';

const server = {
  // Nitro calls `fetch` for each request that is not a file of the build.
  async fetch(): Promise<Response> {
    return renderToResponse(TodoApp, { initial: [] }, { csp: true });
  },
};

export default server;
```

## Rendering

### `renderToResponse`

```ts
function renderToResponse<P>(
  component: (props: P) => unknown,
  props: P,
  options?: ResponseOptions,
): Promise<Response>;
```

Renders a document component and returns the page as a `Response` with `content-type: text/html; charset=utf-8`. The body streams: the first chunk is the whole first render, and the pending chunks follow. The promise rejects when the render throws or the component does not render `<html>`, before any header is decided, so an entry can answer 500.

### `ResponseOptions`

```ts
interface ResponseOptions extends StreamOptions {
  csp?: boolean | CspOptions;
  status?: number;
  headers?: HeadersInit;
}
```

- **`csp`** makes a nonce for the response, writes it on the listener, the loader script, the preload links and the state script, and sets the `content-security-policy` header. `true` is idlip's policy:

  ```
  default-src 'none'; script-src 'nonce-…' 'strict-dynamic'; base-uri 'none'; object-src 'none'; require-trusted-types-for 'script'; trusted-types idlip
  ```

  `extend` adds sources to a directive, such as `{ 'style-src': ["'self'"], 'img-src': ['https:'] }`, and adds a directive the policy lacks. A source added to `default-src` replaces `'none'`. The script directives (`script-src`, `script-src-elem`, `script-src-attr`) and the Trusted Types directives (`trusted-types`, `require-trusted-types-for`) cannot be extended, and a name or a source that holds a space, `;` or `,` throws. In development (`NODE_ENV` other than `production`) the response has no policy header, since Vite's HMR client and error overlay need more than it allows, but the nonce is still written.

- **`nonce`** (from `RenderOptions`) replaces the nonce that `csp` would make, for a host that makes its own.
- **`status`** is 200 by default, and **`headers`** are added to the response. `content-type` is `text/html; charset=utf-8` unless `headers` has one.

### `CspOptions`

```ts
interface CspOptions {
  /** Sources to add to a directive by name. */
  extend?: Readonly<Record<string, readonly string[]>>;
}
```

`csp: { extend }` of `ResponseOptions` takes it. See `csp` above for what `extend` can add.

### `renderToStream`

```ts
function renderToStream<P>(
  component: (props: P) => unknown,
  props: P,
  options?: StreamOptions,
): ReadableStream<string>;
```

Renders a document component as a stream of the whole document. The first chunk is the whole first render: the doctype, the document with the winning title first in its `<head>` and the rest of the `<Head>` output after the document's own head elements, then the listener script, the preload links and the loader script, then `<body>` with the markup and the state script. The pending chunks of the page follow (see `RenderResult.pending`), and `</body></html>` ends the document, in the first chunk when nothing is pending.

The component renders as soon as the stream is constructed, before the reader reads. A render error, or a root that does not render `<html>`, fails the stream before it sends a byte. When the reader cancels, the stream aborts `signal` of the result and stops the pending work. For a status page, call `render`, then `streamParts`.

### `streamParts`

```ts
function streamParts(parts: RenderResult, options?: StreamOptions): ReadableStream<string>;
```

Streams what `render` returned, as `renderToStream` does. Use it when the server needs the parts before it sends headers, such as the `chunks` for a `Link` header or the error of a render. `pending` is single-use: a second `streamParts` on the same result streams no pending chunks.

### `StreamOptions`

```ts
interface StreamOptions extends RenderOptions {
  /** The URL of the loader module, for a page built without the plugin. */
  loader?: string;
  /** Options of `renderPreload` for the links in `<head>`, or `false` for none. */
  preload?: PreloadOptions | false;
}
```

`nonce` is written on the state script, the listener, the loader script and the preload links. The loader URL comes from the build, as `RenderResult.loader`. `loader` replaces it, for a page whose server modules the plugin did not build. A page with neither writes no loader script, and warns in development.

### `render`

```ts
function render<P>(
  component: (props: P) => unknown,
  props: P,
  options?: RenderOptions,
): Promise<RenderResult>;
```

Renders a compiled component and returns the parts of its first render, plus `pending`. The streams write them as a document. The component can be any compiled component: a fragment, a child or a document. A test or a tool reads `body` and `head` from it.

### `RenderOptions`

```ts
interface RenderOptions {
  /** Written on the state script. */
  nonce?: string;
}
```

### `RenderResult`

```ts
interface RenderResult {
  /** The elements of the document head and of every `<Head>`. The title of the last block is first. */
  head: string;
  /** The markup with the state script. For a document, the whole `<html>` element, with the state script before `</body>`. */
  body: string;
  /** True when the component rendered `<html>`. */
  document: boolean;
  /** The URL of the loader module, from the build. Undefined for a module the plugin did not build. */
  loader: string | undefined;
  /** The chunk URLs of the page, the root's and its children's: the first argument of `renderPreload`. */
  chunks: ChunkUrls;
  /** The manifests of the root and of the child modules: the second argument of `renderPreload`. */
  manifests: readonly Manifest[];
  /** Chunks of HTML for `<body>` that follow the first render, as data resolves. Empty for now. */
  pending: AsyncIterable<string>;
  /** Aborts when the reader of a stream cancels, so the work behind `pending` stops. */
  readonly signal: AbortSignal;
  /** Aborts `signal`. The stream calls it on cancel. */
  abort(reason?: unknown): void;
}
```

`renderPreload(page.chunks, page.manifests)` names the chunks of the first click of the rendered page. Both are read-only: the same frozen objects come back from every render of the module.

### `renderListener`

```ts
function renderListener(options?: { nonce?: string }): string;
```

Returns the listener `<script>` tag for the page's `<head>`. The listener queues the events that happen before the loader starts, and the loader replays them. `nonce` is written as the script's `nonce` attribute.

## Preloading

### `renderPreload`

```ts
function renderPreload(
  chunks: ChunkUrls,
  manifest: Manifest | readonly Manifest[],
  options?: PreloadOptions,
): string;
```

Names the chunks of the first click so the browser fetches them with the page. It reads `manifest.listens` of the root manifest, and of the child manifests when the page has children: the handlers the view dispatches on each event and the binding chunks of their write sets. Nothing else is named.

It needs no markup, so the result can go out in a `Link` header as soon as the request is known. Put the `<link>` tags in `<head>`, or send the `header` format with a 103 Early Hints response. The loader imports the same URLs, so the browser reuses each preload. Without handlers it returns an empty string.

`chunks` maps a chunk id to the URL the loader imports. A handler that a child dispatches through a message prop belongs to its parent and is found through the parent's manifest.

### `PreloadOptions`

```ts
interface PreloadOptions {
  /** Event types to preload for, most likely first. Default: `['click']`. */
  events?: readonly string[];
  /** The most chunks to name. Default: 8. */
  max?: number;
  /** `link` returns `<link>` tags. `header` returns a `Link` header value for 103 Early Hints. */
  format?: 'link' | 'header';
  /** Written on each `<link>` tag, for a page with a script nonce policy. */
  nonce?: string;
  /** Written on each preload, for chunks served from another origin. */
  crossorigin?: 'anonymous' | 'use-credentials';
}
```

### `ChunkUrls`

```ts
type ChunkUrls = Readonly<Record<string, string>>;
```

Chunk id (such as `/src/todo.tsx?idlip-handler=toggle&lang.js`) to the URL the loader imports. `RenderResult.chunks` is one, frozen and shared by every render of the module.

### `Manifest`

The manifest of a compiled module: its event types (`events`), the handlers each event dispatches (`listens`), the handler entries with their chunks and write sets (`handlers`), the binding groups (`groups`) and the lists (`lists`), plus optional fields for tasks, sources, `<Try>` regions, `<Head>` and child views. Every field is read-only. `renderPreload` reads `module`, `listens`, `handlers` and `groups`. The full shape is in the compiled format.

## Render helpers

Compiled server modules import these helpers. Client chunks import the same functions from `idlip/helpers`, the module the Vite plugin writes. Application code does not need to call them.

### `attr`

```ts
function attr(name: string, value: unknown): string;
```

Returns an attribute with a leading space, or an empty string when the value is absent.

### `on`

```ts
function on(event: string, message: DomMessage): string;
```

Returns an `on:<event>` attribute with a leading space. The value is the message the loader dispatches.

### `text`

```ts
function text(value: unknown): string;
```

Returns a hole's value as escaped text.

### `safeUrl`

```ts
function safeUrl(value: unknown, name: string, embed?: boolean): unknown;
```

Returns a URL attribute's value, or `undefined` for a `javascript:` or `vbscript:` URL, so the attribute is left out. An object or function is dropped too. Control characters and spaces in a scheme are removed before the test, as a browser ignores them. With `embed`, a `data:` URL is dropped unless it is a raster image. The `values` of an animation is a `;` list, so each part is tested. Every bound value of a URL attribute goes through it, on the server and in a chunk.

### `slot`

```ts
function slot(path: string, site: number, ...keys: unknown[]): string;
```

Returns the model path of a child: the parent's path, then the site of the child and one escaped key for each enclosing loop and an explicit `key`. A key part never holds `/`, `:`, `-` or `>`, so a path splits cleanly and cannot end a comment.

### `track`

```ts
function track(
  store: Record<string, string[]> | undefined,
  name: string,
  model: object,
  read: (model: unknown) => unknown,
): unknown;
```

Runs `read` on a proxy of the model and stores the paths it read in `store[name]`. It records the paths of a dynamic hole, one whose path set the compiler cannot name. Every own field read on a plain object or an array is a path, and an array index reads as `*`, so the paths match the manifest's form. `in`, `Object.keys` and a spread record `<path>.*`, so a key added later counts as a change.
