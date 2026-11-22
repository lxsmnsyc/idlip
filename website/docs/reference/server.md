---
title: idlip/server
order: 101
section: Reference
description: Render a compiled component to HTML, write the listener script and preload the chunks of the first click.
---

`idlip/server` renders compiled components on the server. Import a `*.tsx` module through the Vite plugin, which gives the server build the compiled server module, then pass its default export to `render` or `renderPage`.

```ts
import { renderListener, renderPage } from 'idlip/server';
import TodoApp from './todo.tsx';

export async function renderTodo(nonce: string): Promise<string> {
  const page = await renderPage(TodoApp, { initial: [] }, { nonce });
  return (
    `<!doctype html><html><head>${page.head}${renderListener({ nonce })}` +
    `<script type="module" src="/@id/idlip/client" nonce="${nonce}"></script>` +
    `</head><body>${page.body}</body></html>`
  );
}
```

## Rendering

### `render`

```ts
function render<P>(
  component: (props: P) => unknown,
  props: P,
  options?: RenderOptions,
): Promise<string>;
```

Renders a compiled component to HTML: its markup, then its state script. The state script holds the model, serialized with seroval, so the client resumes without running view code. The elements of a `<Head>` are not in the result: use `renderPage` to get them.

### `renderPage`

```ts
function renderPage<P>(
  component: (props: P) => unknown,
  props: P,
  options?: RenderOptions,
): Promise<RenderResult>;
```

Renders a compiled component and returns the markup for `<head>` next to the body markup. Write `head` inside `<head>` and `body` in `<body>`.

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
  /** The elements of every `<Head>`. The title of the last block is first. */
  head: string;
  body: string;
}
```

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
