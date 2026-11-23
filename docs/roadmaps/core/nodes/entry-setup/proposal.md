# Proposal: the whole document renders from an idlip component

Phase 1 of `entry-setup`. No code has landed. The user approves or changes this API first.

## Summary

- A root component renders `<html>`, `<head>` and `<body>` in TSX. The server adds the doctype, the listener, the loader script, the preload links and the state script. No `start`, `end`, `head` or `scripts` string exists in the API.
- An entry exports `handle(request, options?)` and returns a `Response`. It is one call: `renderToResponse(App, props, options)`.
- `render()` returns the parts of the first render plus `pending` (today's `renderPage` result). `renderPage` is removed.
- The loader URL travels in the chunk map that the plugin already bakes into each compiled server module. No user code reads a manifest, and the server reads no file at run time.
- A component that does not render `<html>` is rejected by the functions that write a document.

## Feasibility in the compiler

Probed on `batch/core` (f3005fb) by compiling small modules and reading the server output. The probe is deleted.

| View                                                            | Result today                                                                                                                  |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `<html lang="en"><head><meta charset="utf-8"/></head><body>..`  | Compiles. The server string holds the three elements as written.                                                              |
| `<html lang={lang}>`, `<body class={...}>`                      | Compiles. The server writes `attr$('lang', lang)` and an `i-a` mark on the element. The client side was not probed.          |
| `<title>` inside `<head>`                                       | Error `title-outside-head`. This blocks the document: the title belongs there. The compiler must allow it.                    |
| `<Head>` inside `<body>`                                        | Compiles. It writes a `<template i-head>` marker in the body and the elements through `context.head`.                         |
| A child component inside `<body>`                               | Compiles (`<Todo initial={props.initial} />`).                                                                                |
| `{a && <html><body>b</body></html>}`, `<div><body>..</body></div>`, a root `<head>` | Compiles with no diagnostic. A client template would drop these tags, so they break at run time. They need an error. |

What else breaks:

- **The state script.** `renderSync` appends it after the markup, so after `</html>`. The parser moves it into `<body>`. The loader takes its root from `script.parentNode` (`client/loader/resume.ts`), which would be `<body>`. A binding on `<html>` or in `<head>` is then outside the root. The server must write the script before `</body>`, and the loader must take `document.documentElement` as the root of a document component (decision 9).
- **Dev remount.** `client/hot.ts` replaces `document.body` only. An edit of `<html>` attributes or of the document head cannot remount, so it reloads the page.
- **The head output.** `RenderResult.head` is written by the host today. For a document the stream must splice it into the component's own `<head>`.

Compiler work for the node: allow `<title>`, `<meta>` and `<link>` as children of the document `<head>`; add the error `document-element-misplaced` (an `html`, `head` or `body` that is not the root skeleton); mark a document root in the manifest. This is a change request to `view-ir` (`contracts/`), written by the implementer.

## The user-facing files for `examples/todo`

`todo.tsx` stays as it is. It is a stateful component with no document. A new `app.tsx` is the document.

### `src/app.tsx`

```tsx
import type { JSX } from 'idlip/jsx-runtime';
import TodoApp from './todo.tsx';

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

export default function App(props: { initial: Todo[] }): JSX.Element {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>todo</title>
      </head>
      <body>
        <TodoApp initial={props.initial} />
      </body>
    </html>
  );
}
```

A page whose title follows the model puts a `<Head>` in `TodoApp` (see "How `<Head>` combines").

### `src/entry-server.ts`

```ts
import { renderToResponse } from 'idlip/server';
import type { RenderOptions } from 'idlip/server';
import App from './app.tsx';

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

const initial: Todo[] = [
  { id: 'a1', text: 'Write the format', done: true },
  { id: 'a2', text: 'Build <the> runtime', done: false },
];

function isTodo(value: unknown): value is Todo {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'id') === 'string' &&
    typeof Reflect.get(value, 'text') === 'string' &&
    typeof Reflect.get(value, 'done') === 'boolean'
  );
}

/** Reads the props from `?props=<json>`, such as `{"initial":[...]}`, or returns the default todos. */
function readProps(url: URL): { initial: Todo[] } {
  const given = url.searchParams.get('props');
  if (given === null) {
    return { initial };
  }
  const parsed: unknown = JSON.parse(given);
  const list: unknown =
    typeof parsed === 'object' && parsed !== null ? Reflect.get(parsed, 'initial') : undefined;
  if (!Array.isArray(list) || !list.every(isTodo)) {
    throw new TypeError('props.initial must be an array of todos');
  }
  return { initial: list.map((t) => ({ id: t.id, text: t.text, done: t.done })) };
}

/**
 * The page for a request. `?preload=off` leaves out the preload links, so the first click loads
 * its chunks.
 */
export function handle(request: Request, options: RenderOptions = {}): Promise<Response> {
  const url = new URL(request.url);
  return renderToResponse(App, readProps(url), {
    ...options,
    preload: url.searchParams.get('preload') === 'off' ? false : {},
  });
}
```

There is no HTML string, no `loader` option and no manifest read. `options.nonce` comes from the host.

### `vite.config.ts`

```ts
import { idlip } from 'idlip/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [idlip({ entry: '/src/entry-server.ts' })],
  environments: {
    client: {
      build: {
        rolldownOptions: {
          // The e2e tests read the loader and chunk names from these file names.
          input: { loader: 'idlip/client' },
          output: {
            entryFileNames: 'assets/[name].[hash].js',
            chunkFileNames: 'assets/[name].[hash].js',
          },
        },
      },
    },
  },
});
```

Gone from today's file: `build.manifest`, `findLoader`, `getPolicy`, `servePages` and `preview.host`. The plugin builds `dist/client` and `dist/server/entry-server.js` as before.

### The dev command

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "start": "node server.js",
    "typecheck": "tsc --noEmit"
  }
}
```

`pnpm dev` runs `vite`. For each `GET` that accepts `text/html`, the plugin imports the entry through Vite's ssr runner and calls `handle(request)` with no nonce. It reads the response body, runs `server.transformIndexHtml` on it (which adds `/@vite/client`) and sends it. The route and the code path are the ones production uses.

### A production Node server: `page.js` and `server.js`

`page.js` is web-standard. The Node server and the Vercel function share it. It owns the nonce and the policy, so the entry has none and dev needs none.

```js
// page.js
import { handle } from './dist/server/entry-server.js';

function getPolicy(nonce) {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    "base-uri 'none'",
    "object-src 'none'",
    "require-trusted-types-for 'script'",
    'trusted-types idlip',
  ].join('; ');
}

export async function handlePage(request) {
  const nonce = btoa(String.fromCodePoint(...crypto.getRandomValues(new Uint8Array(16))));
  const response = await handle(request, { nonce });
  response.headers.set('content-security-policy', getPolicy(nonce));
  return response;
}
```

```js
// server.js
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';
import { handlePage } from './page.js';

const assets = path.join(import.meta.dirname, 'dist/client/assets');

function toRequest(incoming) {
  const url = new URL(incoming.url ?? '/', `http://${incoming.headers.host ?? 'localhost'}`);
  return new Request(url, { method: incoming.method, headers: incoming.headers });
}

async function serveAsset(name, response) {
  const body = await readFile(path.join(assets, name));
  response.writeHead(200, {
    'content-type': 'text/javascript; charset=utf-8',
    // build.js names the build the server runs. Every other file has a hash in its name.
    'cache-control': name === 'build.js' ? 'no-store' : 'public, max-age=31536000, immutable',
  });
  response.end(body);
}

async function servePage(incoming, outgoing) {
  const answer = await handlePage(toRequest(incoming));
  outgoing.writeHead(answer.status, Object.fromEntries(answer.headers));
  Readable.fromWeb(answer.body).pipe(outgoing);
}

createServer((incoming, outgoing) => {
  const { pathname } = new URL(incoming.url ?? '/', 'http://localhost');
  const asset = /^\/assets\/([\w.-]+\.js)$/.exec(pathname);
  const done = asset === null ? servePage(incoming, outgoing) : serveAsset(asset[1], outgoing);
  done.catch(() => {
    outgoing.writeHead(500).end();
  });
}).listen(Number(process.env.PORT ?? 3000));
```

```bash
pnpm exec vite build
node server.js
```

`e2e` runs `node server.js` for the production run, instead of `vite preview` with a plugin in the config. Nothing reads `.vite/manifest.json` and `dist/client/.vite/` is no longer needed.

### A Vercel function

```js
// api/page.js
export { handlePage as GET } from '../page.js';
```

```json
{
  "buildCommand": "vite build",
  "outputDirectory": "dist/client",
  "rewrites": [{ "source": "/", "destination": "/api/page" }],
  "headers": [
    {
      "source": "/assets/build.js",
      "headers": [{ "key": "Cache-Control", "value": "no-store" }]
    }
  ]
}
```

`includeFiles` for the manifest is gone: the function imports `dist/server/entry-server.js`, which holds the chunk URLs and the loader URL.

## Public API

All in `idlip/server` unless noted.

```ts
/** The parts of the first render, plus what resolves later. The result of today's `renderPage`. */
function render<P>(
  component: (props: P) => unknown,
  props: P,
  options?: RenderOptions,
): Promise<RenderResult>;

/** The whole document as a stream. The first chunk is the whole first render. */
function renderToStream<P>(
  component: (props: P) => unknown,
  props: P,
  options?: StreamOptions,
): ReadableStream<string>;

/** Streams the parts that `render` returned. */
function streamParts(parts: RenderResult, options?: StreamOptions): ReadableStream<string>;

/** `render`, then `streamParts`, as a `Response`. Rejects when the render throws, before any byte. */
function renderToResponse<P>(
  component: (props: P) => unknown,
  props: P,
  options?: ResponseOptions,
): Promise<Response>;

interface RenderOptions {
  /** Written on every script and link the server adds. */
  nonce?: string;
}

interface StreamOptions extends RenderOptions {
  /** `renderPreload` options, or `false` for no links. Default: links on. */
  preload?: PreloadOptions | false;
  /** The URL of the loader. Default: the one the plugin built in. For a host without the plugin. */
  loader?: string;
}

interface ResponseOptions extends StreamOptions {
  /** Default 200. */
  status?: number;
  /** Added to `content-type: text/html; charset=utf-8`. */
  headers?: HeadersInit;
}

interface RenderResult {
  /** The head output: the elements of the document head and of every `<Head>`. Winning title first. */
  head: string;
  /** The markup with the state script. For a document component, the whole `<html>` element, with the state script before `</body>`. */
  body: string;
  /** True when the component rendered `<html>`. */
  document: boolean;
  chunks: ChunkUrls;
  manifests: readonly Manifest[];
  /** The URL of the loader module, from the build. Undefined outside the plugin. */
  loader: string | undefined;
  pending: AsyncIterable<string>;
  readonly signal: AbortSignal;
  abort(reason?: unknown): void;
}
```

- `renderPage` is removed. Its callers use `render`. The old string `render` is removed too; a caller that needs only the markup reads `result.body`.
- `renderToStream`, `streamParts` and `renderToResponse` need a document component (see "A component that does not render `<html>`"). `render` takes any component, so tests and fixtures with a fragment keep working.
- `StreamOptions.loader` is the override. Without it the stream uses `RenderResult.loader`. When neither exists the stream writes no loader script and, in dev, warns.
- The entry contract, read by the plugin and by hosts:

```ts
export function handle(request: Request, options?: RenderOptions): Response | Promise<Response>;
```

### What the plugin provides (`idlip/vite`)

- Compiles the modules and emits the client chunks, as today.
- Bakes the chunk URLs into each compiled server module, as today, and adds the loader URL to the same map under a `loader` key, next to `build` and `helpers`.
- The `entry` option names the file that exports `handle`. It is the input of the ssr build when the config sets none.
- In `vite dev`: the middleware described above.
- No `setLoader`, no global, no file the server reads, no `build.manifest` requirement.

## What the server injects, and where

For `App` above, the response reads (line breaks added):

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>todo</title>
    <script nonce="N">/* listener */</script>
    <link rel="modulepreload" href="/assets/…" nonce="N" />  <!-- one per preloaded chunk -->
    <script type="module" async src="/assets/loader.….js" nonce="N"></script>
  </head>
  <body>
    …the todo markup…
    <script i-state i-build="…" nonce="N">(self.$idlip||=[]).push(…)</script>
  </body>
</html>
```

| Part                     | Written by                | Where                                                                  | Nonce |
| ------------------------ | ------------------------- | ---------------------------------------------------------------------- | ----- |
| `<!doctype html>`        | the server                | before `<html>`                                                        | no    |
| head output              | the server, from `<head>` | the document head and every `<Head>`, in the component's `<head>`      | no    |
| listener                 | the server                | in `<head>`, after the head output                                     | yes   |
| preload links            | the server                | in `<head>`, after the listener                                        | yes   |
| loader script            | the server                | last in `<head>`, `type="module" async`                                | yes   |
| state script             | the server                | at the end of `<body>`, before `</body>`                               | yes   |
| pending chunks, `</body>` | the stream               | after the state script, then the closing tags                          | yes   |

- The user's own head elements come first, so `<meta charset>` stays within the first 1024 bytes. The one exception is the title: when several titles exist, the winner goes first, as `<Head>` does today.
- The first chunk is the whole first render, as `render-stream` built it. The stream finds the end of `<head>` and of `<body>` in the document markup with one scan for the first `</head>` and the last `</body>`. The document head compiles with no raw content, so the match is safe.
- A bare `<html>` with no `<head>` is an error (decision 3's rule): the head is where the server writes.

## How `<Head>` combines with the document's `<head>`

- **The document `<head>` is the first `<Head>` block.** Its elements follow every rule of `<Head>`: elements only, no events, `ref` or `html`; one `<title>`; a hole in a title is its only content. The compiler allows `<title>` there (it is `title-outside-head` today).
- **Page order ranks it first.** A `<Head>` anywhere in the body ranks after it, so its title wins over the document's. The document's title is the default title. The existing rule "the last title wins" needs no change.
- **Elements are added, not replaced.** A `<meta name="description">` in the document and another in a `<Head>` both appear. Merging by `name` is not proposed.
- **The client machinery is the same.** The document head elements carry `i-head="0.<index>"` like any block, so a bound `content` or a bound title patches through `client/head.ts`.
- **Example.** `TodoApp` adds `<Head><title>{left} left</title></Head>`. The tab reads `1 left`, and the document's `todo` shows when that block leaves.

## What may be dynamic in `<html>` and `<head>`

| Position                                              | Static | Bound attribute or hole | Notes                                                                                           |
| ----------------------------------------------------- | ------ | ----------------------- | ----------------------------------------------------------------------------------------------- |
| `<html lang>`, other attributes of `<html>`           | yes    | yes                     | Server writes it through `attr$`. The client patches it. Needs the document root (decision 9). |
| `<body>` attributes                                   | yes    | yes                     | Inside the root already.                                                                        |
| `<title>` in the document head                        | yes    | yes, one hole           | `<Head>` rules. Patches the tab.                                                                |
| `<meta>`, `<link>` attributes in the document head    | yes    | yes                     | `<Head>` rules.                                                                                 |
| conditions, `<For>`, `<Try>` around `html`, `head`, `body` | -  | no                      | The skeleton is fixed. Error `document-element-misplaced`.                                      |
| conditional head elements                             | -      | via `<Head>` in a condition | Existing feature. Not inside the document head.                                             |
| events, `ref`, `html=` on `html`, `head`, `body`      | -      | no                      | Error. Use `<Window>`-style global events when `core` adds them.                                |
| `<script>`, `<style>` in the document head            | -      | no                      | Not elements of a `<Head>` today. A stylesheet is a `<link>`.                                   |

Rules of the skeleton: the root of the view is `<html>`, whose children are exactly one `<head>` then one `<body>`. A component other than the root never renders them.

## A component that does not render `<html>`

**Recommendation: reject.** `renderToStream`, `streamParts` and `renderToResponse` throw `TypeError: The root component must render <html>. Wrap it in a document component` (for `renderToResponse`, a rejection). The check reads `RenderResult.document`, a flag the compiler writes into the manifest.

- **Why reject.** A wrapped page has no charset, viewport, title or `lang`, and nobody sees the gap until the page is live. The brief says the whole document renders from an idlip component. A default wrapper is a document in a string.
- **Alternative A: wrap.** The server writes `<html><head></head><body>…</body></html>` around a fragment. It keeps old entries working and costs one branch. The pages it makes are the poor ones above.
- **Alternative B: brumate's `start` and `end` strings.** Rejected by the user's rule: user code builds no HTML strings.
- `render()` takes a fragment. Tests, fixtures and the website demo use it.

## How the loader URL and the chunk map reach the server

**Production.** The client build already writes `.idlip/chunks.json`, and the ssr build already replaces the chunk URLs in each compiled server module from it (`replaceChunkUrls`, `getChunkUrls` in `vite/plugin.ts`). The map also holds `build` and `helpers`. The plugin adds `loader`: the file `findLoaderFile` already finds for `build.js`. `buildPart` drops it from the state script, as it drops `build`, and returns it as `RenderResult.loader`. The URL is in `dist/server/entry-server.js`, so a Vercel function or a Worker needs no file.

**Dev.** `getChunkUrls` returns the chunk ids as URLs under `base`. It adds `loader: <base>@id/idlip/client`, the URL the plugin already proxies (`DEV_LOADER_URL`). With `base: '/'` that is today's `/@id/idlip/client`.

**Outside the plugin.** A test or a host without the plugin passes `StreamOptions.loader`. Without it, the stream writes no loader script.

**Brumate's way, and why not here.** Brumate writes `.brumate/hints.json` in the client build, and the server build reads it when it starts and calls `setClientBundles(bundles)`, a module-level global. Idlip's server modules already carry the chunk URLs, so one more key in that map needs no file, no read and no global.

## What the plugin does in dev

1. `configureServer` keeps the proxy for `/@id/idlip/client`.
2. For `GET` with `Accept: text/html`: imports `entry` through `environments.ssr.runner`, builds a `Request` from the Node request, calls `handle(request)`.
3. Reads the response body to a string, runs `transformIndexHtml`, and sends it with the response's status and headers.

The stream is buffered in dev only, since `transformIndexHtml` needs the whole page. Dev sends no nonce, so Vite's inline and injected scripts are not blocked. Production sends the CSP from `page.js`. A test of the dev path and the production path on the same entry compares their documents.

## Decisions for the user

1. **The entry contract.** Recommend: a named export `handle(request, options?)` that returns a `Response`. Alternatives: `export default { fetch(request) }` (what brumate's Nitro entry uses, works on Workers and Bun as it is, but the nonce has no place in it); the old `render(url, options)` returning a stream (a second shape next to `Response`).
2. **`renderToResponse`.** Recommend: add it. It renders first, so a throwing component rejects before the headers, and it encodes and sets the content type. Alternative: no helper; each entry writes `new Response(stream.pipeThrough(new TextEncoderStream()), { headers })` and cannot answer 500 on a render error without reading the first chunk.
3. **A component that does not render `<html>`.** Recommend: reject in the functions that write a document. Alternatives: wrap with a default document; brumate's `start` and `end` strings (against the rules).
4. **`<title>` in the document head.** Recommend: allow it, and treat the document head as the first `<Head>` block. Alternative: keep `title-outside-head` and allow a title only through `<Head>` in the body. That keeps one rule but puts the default title away from `<head>`.
5. **What is dynamic.** Recommend: bound attributes on `<html>` and `<body>`, `<Head>` rules in the head, and a fixed skeleton. Alternative: static `<html>` and `<body>` attributes only. It is simpler and needs no new root kind, but `lang` could not follow the model.
6. **How the loader URL arrives.** Recommend: a `loader` key in the chunk map baked into the server modules. Alternatives: a `setLoader(url)` call that the plugin injects into the entry, as brumate's `setClientBundles`; a JSON file the server reads at start.
7. **Who owns the nonce and the CSP.** Recommend: the production server and the Vercel `page.js`, which pass `{ nonce }` to `handle`. The entry and dev have no policy. Alternative: the entry sets the policy. Dev then needs a looser one for `/@vite/client`, and the entry branches on `import.meta.env.PROD`.
8. **`vite preview`.** Recommend: the plugin does not serve pages there. The production run in e2e is `node server.js`, the file the docs show. Alternative: the plugin adds a preview middleware like the dev one, with no nonce and so no CSP test.
9. **A document root in the loader.** Needed for a bound `<html>`. Recommend: the state script becomes `<script i-state="document">`, and the loader takes `document.documentElement` as the root. A format change to `compiled-format`. Alternative (with decision 5, static): keep the body as the root and reject bound `<html>` attributes.
10. **Removing `renderPage` and the string `render`.** Recommend: remove both now. `0.1` is not released. Alternative: keep `renderPage` for one release as an alias of `render`.
11. **Edits to `<html>` and the document head in dev.** Recommend: a full reload. The remount swaps `<body>` only. Alternative: remount the head and root attributes too.
12. **A Node adapter.** Recommend: none shipped. `toRequest` and the pipe are six lines in `server.js`, as in brumate's example. Alternative: `idlip/node` exports `toRequest` and `send`.
13. **Split of the `todo` files.** Recommend: `app.tsx` is the document and `todo.tsx` stays free of it, so the website demo and the REPL keep showing a component without `<html>`. Alternative: `todo.tsx` renders the document itself.

## Where brumate does the same or differently

| Topic                       | Brumate                                                                                      | This proposal                                                                 | Why                                                                                       |
| --------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Document                    | `_layout.brm` renders `<html>`. The server adds the doctype, the head of the components and the scripts. | Same. The root component renders `<html>`.                              | The user asked for it.                                                                    |
| Title                       | `<title>` in `#head`, or in the `<head>` of a document component.                           | `<title>` in the document head, which is the first `<Head>` block.            | One rule for every head element.                                                          |
| `render`                    | `render(Root, props, options)` returns `{ html, head, state, pending, headers, status }`.    | `render` returns `{ head, body, pending, … }`.                                | The same split: parts first, then a stream. Idlip has no event, so no `headers`, `status`. |
| Stream                      | `renderToStream`, `streamParts`.                                                             | The same names, built by `render-stream`.                                     | -                                                                                         |
| A component without `<html>` | `start` and `end` strings in `DocumentOptions`.                                             | Rejected.                                                                     | The user's rule: no HTML strings in user code.                                            |
| Extra markup                | `scripts` and `head` strings.                                                                | None. The plugin and `<Head>` supply them.                                    | Same rule.                                                                                |
| Client bundles              | The client build writes `.brumate/hints.json`. The server reads it and calls `setClientBundles`. | A `loader` key in the chunk map baked into the server modules.            | The chunk map is already baked in. No file and no global.                                 |
| Dev                         | `vite.ssrLoadModule` in the user's `server.ts`, with `scripts` naming `/@vite/client` and `/src/client.ts`. | The plugin's middleware calls `handle` and runs `transformIndexHtml`.   | The user wrote no dev server. The task says dev and production send the same document.   |
| Production server           | A hand-written Node server with `toRequest` and `send`; Nitro for hosts.                      | The same shape: `server.js`, `page.js`. No Nitro.                             | Idlip has no router or server functions yet.                                              |
| Request in the render       | `request` option and `getEvent()`.                                                           | The entry derives props from `request`. No request context in components.     | Routing and data loading are non-goals of this roadmap.                                   |
| CSP                         | `nonce` in the render options.                                                               | The same `nonce` option, on every script and link the server adds.            | -                                                                                         |
| Hints                       | `earlyHints` callback, `Link` headers.                                                       | Unchanged: `renderPreload(..., { format: 'header' })` stays.                  | Outside this node.                                                                        |

## Work after approval

Phase 2 changes, in order: the compiler (title in head, skeleton errors, document flag, state script before `</body>`), the loader root, `loader` in the chunk map, `render` and `renderToResponse`, the stream splice, the dev middleware, then every caller: `examples/*`, `benchmarks/idlip/*`, `website/src/demo/build.ts`, the docs (getting started, components, head, deploying, reference, README) and the e2e server start. Tests: a document component renders the doctype, the framework scripts in `<head>`, the state script in `<body>` and the nonce on each; a differential subject for a document component.
