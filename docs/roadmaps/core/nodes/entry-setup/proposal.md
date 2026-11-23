# Proposal: the whole document renders from an idlip component

**Approved by the user on 2026-11-23.** Every decision follows its recommendation. The user confirmed two in particular: decision 3 (a root that does not render `<html>` is rejected, over brumate's `start` and `end` strings and over wrapping), and decision 13 (the config carries the `build.js` `no-store` route rule, and the docs say that retaining the previous build needs a persistent client folder). Phase 2 implements it. Where the build forced a change, `outcome.md` lists it under Deviations.

Phase 1 of `entry-setup`. No code had landed when this was written.

Revision 2 (2026-11-23): the user chose Nitro 3 as the default server, as brumate does. The entry is Nitro's `export default { fetch }`, `renderToResponse` owns the nonce and the policy, and the hand-written Node server and the Vercel function are gone.

## Summary

- A root component renders `<html>`, `<head>` and `<body>` in TSX. The server adds the doctype, the listener, the loader script, the preload links and the state script. No `start`, `end`, `head` or `scripts` string exists in the API.
- An entry is `export default { fetch(request) }` and returns a `Response`. It is one call: `renderToResponse(App, props, { csp: true })`.
- `csp: true` makes the nonce, puts it on every script and link the server adds, and sets the `content-security-policy` header. User files hold no policy code.
- Nitro (`nitro/vite`) serves dev and builds production (`.output/server/index.mjs`) for Node, Vercel, Cloudflare and the other presets. There is no `server.js` and no `page.js`.
- The plugin's own dev middleware stays as the fallback for a project without Nitro. It calls the same `fetch`. It stands aside when it sees Nitro.
- `render()` returns the parts of the first render plus `pending` (today's `renderPage` result). `renderPage` is removed.
- The loader URL travels in the chunk map that the plugin already bakes into each compiled server module. No user code reads a manifest, and the server reads no file at run time.
- A component that does not render `<html>` is rejected by the functions that write a document.

## Feasibility in the compiler

Probed on `batch/core` (f3005fb) by compiling small modules and reading the server output. The probe is deleted.

| View                                                                                | Result today                                                                                                         |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `<html lang="en"><head><meta charset="utf-8"/></head><body>..`                      | Compiles. The server string holds the three elements as written.                                                     |
| `<html lang={lang}>`, `<body class={...}>`                                          | Compiles. The server writes `attr$('lang', lang)` and an `i-a` mark on the element. The client side was not probed.  |
| `<title>` inside `<head>`                                                           | Error `title-outside-head`. This blocks the document: the title belongs there. The compiler must allow it.           |
| `<Head>` inside `<body>`                                                            | Compiles. It writes a `<template i-head>` marker in the body and the elements through `context.head`.                |
| A child component inside `<body>`                                                   | Compiles (`<Todo initial={props.initial} />`).                                                                       |
| `{a && <html><body>b</body></html>}`, `<div><body>..</body></div>`, a root `<head>` | Compiles with no diagnostic. A client template would drop these tags, so they break at run time. They need an error. |

What else breaks:

- **The state script.** `renderSync` appends it after the markup, so after `</html>`. The parser moves it into `<body>`. The loader takes its root from `script.parentNode` (`client/loader/resume.ts`), which would be `<body>`. A binding on `<html>` or in `<head>` is then outside the root. The server must write the script before `</body>`, and the loader must take `document.documentElement` as the root of a document component (decision 9).
- **Dev remount.** `client/hot.ts` replaces `document.body` only. An edit of `<html>` attributes or of the document head cannot remount, so it reloads the page.
- **The head output.** `RenderResult.head` is written by the host today. For a document the stream must splice it into the component's own `<head>`.

Compiler work for the node: allow `<title>`, `<meta>` and `<link>` as children of the document `<head>`; add the error `document-element-misplaced` (an `html`, `head` or `body` that is not the root skeleton); mark a document root in the manifest. This is a change request to `view-ir` (`contracts/`), written by the implementer.

## Feasibility with Nitro 3

Checked in a scratch copy of `examples/todo` with `nitro@3.0.260903-beta` (the version brumate pins) next to `idlip()`. The copy used today's entry with a default-export `fetch` and a hard-coded loader URL, since the new API is not built. The copy is deleted. Brumate's setup is `examples/nitro` and the "Deploying with Nitro" section of its `deploying.md`.

What works:

- **The two-environment build.** `vite build` runs the client build (idlip chunks, `build.js`, the loader), then the ssr build, then Nitro's own build. Nitro moves the client output to `.output/public` and writes `.output/server/index.mjs` (with `_ssr/ssr.mjs`, which holds the entry). `PORT` sets the port.
- **The chunk map is baked into the server module.** `.output/server/_ssr/ssr.mjs` holds the chunk URLs (`/assets/todo.handler.toggle.<hash>.js`), `helpers` and the build id. The state script of a page rendered by `node .output/server/index.mjs` carried them, and `build.js` served by Nitro carried the same build id. A `loader` key joins the map by the same path, so it works with no change to the transport.
- **Static files.** Nitro serves `/assets/*` from `.output/public`, hashed files with `cache-control: public, max-age=31536000, immutable`.
- **Dev.** With the ssr input set and idlip's middleware off, `vite dev` served the page through Nitro: a 200 with the listener, the state script and `modulepreload` links to `/src/todo.tsx?idlip-handler=…`. `/@id/idlip/client` still answered 200 through the plugin's proxy.
- **Output.** The Node preset is the default. The build log says `preset: node-server`. `NITRO_PRESET` or `nitro({ preset })` picks another. The Vercel and Cloudflare presets were not built.

What breaks, and the fix in this proposal:

1. **The plugin's dev middleware and Nitro both serve pages.** With `idlip({ entry })` and `nitro()`, `vite dev` answered every page with 500 `idlip needs a runnable ssr environment to render pages in dev`: Nitro runs the ssr environment in its own worker, so the plugin's runner is not runnable. The plugin must detect Nitro and not install the middleware (decision 8).
2. **Nitro finds no entry unless the ssr input is set.** With the input unset, dev answered `Cannot find any route matching [GET] /`. idlip's `entry` option already sets the ssr input (`createConfig`), so `idlip({ entry })` stays the one place that names the entry.
3. **`build.js` is served `immutable` for a year.** The skew recovery needs `no-store` on it (`deploying.md`). `nitro({ routeRules: { '/assets/build.js': { headers: { 'cache-control': 'no-store' } } } })` fixed it: `cache-control: no-store` on `build.js`, immutable on the rest. This line goes in `vite.config.ts` (decision 13).
4. **Retention of the previous build does not work.** `keepBuilds` keeps the files of the build before the last one in the client output folder. Nitro empties `.output/public` on each build: after a build that changed a handler, the old `todo.handler.add.<hash>.js` was gone, while `dist/.idlip/builds.json` still listed it. This is the same case as a Vercel build from a clean checkout. A cached page of an older build finds its chunk gone and reloads once, as `deploying.md` describes. The recovery by reload was not run under Nitro. A page one build old no longer works without a reload (decision 13).
5. **No `/@vite/client` in the page.** The page that Nitro serves in dev is not run through `transformIndexHtml`, so Vite's HMR client is missing. Brumate writes the script by hand in its entry with `import.meta.env.DEV`. Here the plugin makes its dev loader module import `/@vite/client` (decision 12). That change was not run.
6. **`NODE_ENV`.** `DEV` in `core/dev.ts` reads `process.env.NODE_ENV !== 'production'`. A build under vitest needs `NODE_ENV=production`, as brumate's test sets it. Nitro printed one warning about `output.codeSplitting.groups[0].name`. It is harmless.
7. **Nitro 3 is a beta**, pinned by version (`3.0.260903-beta`), as brumate does.

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

export default {
  // Nitro calls `fetch` for each request that is not a file of the build.
  // `?preload=off` leaves out the preload links, so the first click loads its chunks.
  fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    return renderToResponse(App, readProps(url), {
      csp: true,
      preload: url.searchParams.get('preload') === 'off' ? false : {},
    });
  },
};
```

There is no HTML string, no `loader` option, no manifest read, no nonce and no policy.

### `vite.config.ts`

```ts
import { idlip } from 'idlip/vite';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    // `entry` is the ssr input, which Nitro serves. The plugin skips its own dev middleware.
    idlip({ entry: '/src/entry-server.ts' }),
    // The skew check reads build.js on each visit, so it must not be cached.
    nitro({ routeRules: { '/assets/build.js': { headers: { 'cache-control': 'no-store' } } } }),
  ],
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

Nitro needs two things to find the app, as in brumate: the plugin after `idlip()` (`nitro()`), and the ssr input, which `idlip({ entry })` sets. The ssr environment's input stays the entry file, whose default export is `{ fetch }`. Brumate's config names the client input instead (`src/client.ts`), since its entry imports `?assets=client`. Idlip's client input is the loader `idlip/client`, which the plugin defaults, and the loader URL reaches the server through the chunk map.

Gone from today's file: `build.manifest`, `findLoader`, `getPolicy`, `servePages`, `preview.host` and the Node imports.

### `package.json` scripts

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "start": "node .output/server/index.mjs",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": { "nitro": "3.0.260903-beta" }
}
```

- **Dev.** `pnpm dev` runs Vite with Nitro. Nitro calls `fetch`. A project without `nitro()` gets the plugin's fallback middleware, which calls the same `fetch`.
- **Production, Node.** `pnpm build` writes `.output/`. `pnpm start` runs `node .output/server/index.mjs`. `PORT` sets the port. `.output/public` holds the client files, which the server serves itself.
- **Vercel.** `NITRO_PRESET=vercel vite build`, or `nitro({ preset: 'vercel' })`. Nitro writes the function and the static output. There is no `vercel.json` and no `api/page.js`.
- **Cloudflare.** `NITRO_PRESET=cloudflare-module vite build`, or `nitro({ preset: 'cloudflare-module' })`.
- The Vercel and Cloudflare presets are brumate's documented ones. They were not built here; the implementer builds both in a scratch run before the docs claim them.

### The Nitro setup in `deploying.md`

The section replaces `page.js`, `server.js` and the Vercel function. It states: the build writes `.output`, `node .output/server/index.mjs` serves it, the presets, the `build.js` route rule, and that retention of the previous build needs the client folder to persist between builds (decision 13).

### e2e

The production run is `vite build` with `NODE_ENV=production`, then `PORT=<free port> node .output/server/index.mjs`. The CSP header the tests read comes from `renderToResponse`. The dev run is `vite dev --port <free port>`. Nothing runs `vite preview`.

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
  /** Written on every script and link the server adds. A host that makes its own nonce passes it. */
  nonce?: string;
}

interface StreamOptions extends RenderOptions {
  /** `renderPreload` options, or `false` for no links. Default: links on. */
  preload?: PreloadOptions | false;
  /** The URL of the loader. Default: the one the plugin built in. For a host without the plugin. */
  loader?: string;
}

interface ResponseOptions extends StreamOptions {
  /**
   * Makes a nonce, uses it for every script and link the server adds, and sets the
   * `content-security-policy` header. `true` is idlip's policy. An object adds sources to it.
   * With `nonce`, it uses that nonce and makes none. Ignored in development, except that the
   * nonce still goes on the scripts.
   */
  csp?: boolean | CspOptions;
  /** Default 200. */
  status?: number;
  /** Added to `content-type: text/html; charset=utf-8`. */
  headers?: HeadersInit;
}

interface CspOptions {
  /** Sources added to a directive, such as `{ 'style-src': ["'self'"], 'img-src': ['https:'] }`. */
  extend?: Readonly<Record<string, readonly string[]>>;
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
- **The policy `csp: true` sets**, with `NONCE` the value it made:

```
default-src 'none'; script-src 'nonce-NONCE' 'strict-dynamic'; base-uri 'none'; object-src 'none'; require-trusted-types-for 'script'; trusted-types idlip
```

`{ extend }` appends sources to a directive of that name, or adds the directive. `default-src 'none'` blocks styles, images and fetches, so a page with a stylesheet needs `{ extend: { 'style-src': ["'self'"] } }`. `script-src` and `trusted-types` cannot be extended: an entry for them throws. `streamParts`, `renderToStream` and `render` take `nonce` only. They set no header, since they return no headers.

- The entry contract, read by Nitro, by the plugin's fallback and by any host:

```ts
export default { fetch(request: Request): Response | Promise<Response> };
```

### What the plugin provides (`idlip/vite`)

- Compiles the modules and emits the client chunks, as today.
- Bakes the chunk URLs into each compiled server module, as today, and adds the loader URL to the same map under a `loader` key, next to `build` and `helpers`.
- The `entry` option names the file whose default export is `{ fetch }`. It is the input of the ssr build when the config sets none. It is also what the fallback dev middleware imports.
- The fallback dev middleware, off when Nitro is present (below).
- The dev loader module (`\0idlip:dev-loader`) imports `/@vite/client`, so a page needs no `transformIndexHtml`.
- No `setLoader`, no global, no file the server reads, no `build.manifest` requirement.

### How the plugin stands aside for Nitro

The plugin looks at `config.plugins` in `configResolved` for a plugin named `nitro:main` (the name Nitro 3's Vite plugin has in the pinned version; checked in its package). When one is there, `configureServer` installs no page middleware. It still installs the proxy for `/@id/idlip/client`, which Nitro does not serve. The plugin's `entry` still sets the ssr input. Order of the two plugins in the array does not matter, since the check runs after the config resolves.

Without Nitro, the fallback runs: for `GET` with `Accept: text/html`, it imports `entry` through the ssr runner, builds a `Request`, calls `default.fetch(request)`, and sends the response (status, headers, body). It sends no nonce or policy, since `csp` is ignored in dev. It runs no `transformIndexHtml`.

A project that has a Nitro-like server of its own and wants the middleware off passes `idlip({ server: false })`. Detection is automatic for Nitro only (decision 8).

## What the server injects, and where

For `App` above, the response reads (line breaks added):

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>todo</title>
    <script nonce="N">
      /* listener */
    </script>
    <link rel="modulepreload" href="/assets/…" nonce="N" />
    <!-- one per preloaded chunk -->
    <script type="module" async src="/assets/loader.….js" nonce="N"></script>
  </head>
  <body>
    …the todo markup…
    <script i-state i-build="…" nonce="N">
      (self.$idlip||=[]).push(…)
    </script>
  </body>
</html>
```

| Part                      | Written by                | Where                                                             | Nonce |
| ------------------------- | ------------------------- | ----------------------------------------------------------------- | ----- |
| `<!doctype html>`         | the server                | before `<html>`                                                   | no    |
| head output               | the server, from `<head>` | the document head and every `<Head>`, in the component's `<head>` | no    |
| listener                  | the server                | in `<head>`, after the head output                                | yes   |
| preload links             | the server                | in `<head>`, after the listener                                   | yes   |
| loader script             | the server                | last in `<head>`, `type="module" async`                           | yes   |
| state script              | the server                | at the end of `<body>`, before `</body>`                          | yes   |
| pending chunks, `</body>` | the stream                | after the state script, then the closing tags                     | yes   |

- The user's own head elements come first, so `<meta charset>` stays within the first 1024 bytes. The one exception is the title: when several titles exist, the winner goes first, as `<Head>` does today.
- The first chunk is the whole first render, as `render-stream` built it. The stream finds the end of `<head>` and of `<body>` in the document markup with one scan for the first `</head>` and the last `</body>`. The document head compiles with no raw content, so the match is safe.
- A bare `<html>` with no `<head>` is an error: the head is where the server writes.
- In dev the nonce goes on the same scripts, but no header is sent. Vite's HMR client is a module that the dev loader imports, so it needs no script of its own.

## How `<Head>` combines with the document's `<head>`

- **The document `<head>` is the first `<Head>` block.** Its elements follow every rule of `<Head>`: elements only, no events, `ref` or `html`; one `<title>`; a hole in a title is its only content. The compiler allows `<title>` there (it is `title-outside-head` today).
- **Page order ranks it first.** A `<Head>` anywhere in the body ranks after it, so its title wins over the document's. The document's title is the default title. The existing rule "the last title wins" needs no change.
- **Elements are added, not replaced.** A `<meta name="description">` in the document and another in a `<Head>` both appear. Merging by `name` is not proposed.
- **The client machinery is the same.** The document head elements carry `i-head="0.<index>"` like any block, so a bound `content` or a bound title patches through `client/head.ts`.
- **Example.** `TodoApp` adds `<Head><title>{left} left</title></Head>`. The tab reads `1 left`, and the document's `todo` shows when that block leaves.

## What may be dynamic in `<html>` and `<head>`

| Position                                                   | Static | Bound attribute or hole     | Notes                                                                                          |
| ---------------------------------------------------------- | ------ | --------------------------- | ---------------------------------------------------------------------------------------------- |
| `<html lang>`, other attributes of `<html>`                | yes    | yes                         | Server writes it through `attr$`. The client patches it. Needs the document root (decision 9). |
| `<body>` attributes                                        | yes    | yes                         | Inside the root already.                                                                       |
| `<title>` in the document head                             | yes    | yes, one hole               | `<Head>` rules. Patches the tab.                                                               |
| `<meta>`, `<link>` attributes in the document head         | yes    | yes                         | `<Head>` rules.                                                                                |
| conditions, `<For>`, `<Try>` around `html`, `head`, `body` | -      | no                          | The skeleton is fixed. Error `document-element-misplaced`.                                     |
| conditional head elements                                  | -      | via `<Head>` in a condition | Existing feature. Not inside the document head.                                                |
| events, `ref`, `html=` on `html`, `head`, `body`           | -      | no                          | Error.                                                                                         |
| `<script>`, `<style>` in the document head                 | -      | no                          | Not elements of a `<Head>` today. A stylesheet is a `<link>`.                                  |

Rules of the skeleton: the root of the view is `<html>`, whose children are exactly one `<head>` then one `<body>`. A component other than the root never renders them.

## A component that does not render `<html>`

**Recommendation: reject.** `renderToStream`, `streamParts` and `renderToResponse` throw `TypeError: The root component must render <html>. Wrap it in a document component` (for `renderToResponse`, a rejection). The check reads `RenderResult.document`, a flag the compiler writes into the manifest.

- **Why reject.** A wrapped page has no charset, viewport, title or `lang`, and nobody sees the gap until the page is live. The brief says the whole document renders from an idlip component. A default wrapper is a document in a string.
- **Alternative A: wrap.** The server writes `<html><head></head><body>…</body></html>` around a fragment. It keeps old entries working and costs one branch. The pages it makes are the poor ones above.
- **Alternative B: brumate's `start` and `end` strings.** Rejected by the user's rule: user code builds no HTML strings.
- `render()` takes a fragment. Tests, fixtures and the website demo use it.

## How the loader URL and the chunk map reach the server

**Production.** The client build already writes `.idlip/chunks.json`, and the ssr build already replaces the chunk URLs in each compiled server module from it (`replaceChunkUrls`, `getChunkUrls` in `vite/plugin.ts`). The map also holds `build` and `helpers`. The plugin adds `loader`: the file `findLoaderFile` already finds for `build.js`. `buildPart` drops it from the state script, as it drops `build`, and returns it as `RenderResult.loader`. The URL is in the server bundle, so Nitro's output, a Vercel function or a Worker needs no file. Checked under Nitro: the map and the build id were in `.output/server/_ssr/ssr.mjs`.

**Dev.** `getChunkUrls` returns the chunk ids as URLs under `base`. It adds `loader: <base>@id/idlip/client`, the URL the plugin already proxies (`DEV_LOADER_URL`). With `base: '/'` that is today's `/@id/idlip/client`. Checked under Nitro: the page had that URL, and it answered 200.

**Outside the plugin.** A test or a host without the plugin passes `StreamOptions.loader`. Without it, the stream writes no loader script.

**Brumate's way, and why not here.** Brumate writes `.brumate/hints.json` in the client build, and the server build reads it when it starts and calls `setClientBundles(bundles)`, a module-level global. Idlip's server modules already carry the chunk URLs, so one more key in that map needs no file, no read and no global.

## Decisions for the user

1. **The entry contract.** Set by the user: `export default { fetch(request) }`, Nitro's shape. Alternative the user dropped: a named `handle(request, options)`. With `fetch` the nonce has no argument, which decision 7 resolves.
2. **`renderToResponse`.** Recommend: add it. It renders first, so a throwing component rejects before the headers, it makes the nonce and the policy, and it encodes and sets the content type. Alternative: no helper; each entry writes the stream plumbing and cannot set the policy or answer 500 on a render error.
3. **A component that does not render `<html>`.** Recommend: reject in the functions that write a document. Alternatives: wrap with a default document; brumate's `start` and `end` strings (against the rules).
4. **`<title>` in the document head.** Recommend: allow it, and treat the document head as the first `<Head>` block. Alternative: keep `title-outside-head` and allow a title only through `<Head>` in the body. That keeps one rule but puts the default title away from `<head>`.
5. **What is dynamic.** Recommend: bound attributes on `<html>` and `<body>`, `<Head>` rules in the head, and a fixed skeleton. Alternative: static `<html>` and `<body>` attributes only. It is simpler and needs no new root kind, but `lang` could not follow the model.
6. **How the loader URL arrives.** Recommend: a `loader` key in the chunk map baked into the server modules. Alternatives: a `setLoader(url)` call that the plugin injects into the entry, as brumate's `setClientBundles`; a JSON file the server reads at start.
7. **The `csp` option.** Recommend: `csp?: boolean | { extend }`, where `true` is idlip's policy and `extend` adds sources per directive (`script-src` and `trusted-types` cannot be extended). Dev gets no policy: with `default-src 'none'`, Vite's HMR socket and error overlay would be blocked, and a looser dev policy would test something production does not send. The nonce still goes on the scripts in dev, so the code path is the same. An explicit `nonce` stays for hosts that make their own, and then `csp` uses it. Alternatives: `csp: true` only, with no way to add a `style-src`; a full policy string (user code writes policy again); a looser policy in dev.
8. **How the plugin finds Nitro.** Recommend: automatic, by a plugin named `nitro:main` in `config.plugins`, plus `idlip({ server: false })` for any other server. Alternatives: only the explicit option (every Nitro project writes one more line, and forgetting it gives a 500 in dev, as measured); no fallback middleware at all (drops the projects without Nitro, and the benchmark and website apps need one).
9. **A document root in the loader.** Needed for a bound `<html>`. Recommend: the state script becomes `<script i-state="document">`, and the loader takes `document.documentElement` as the root. A format change to `compiled-format`. Alternative (with decision 5, static): keep the body as the root and reject bound `<html>` attributes.
10. **Removing `renderPage` and the string `render`.** Recommend: remove both now. `0.1` is not released. Alternative: keep `renderPage` for one release as an alias of `render`.
11. **Edits to `<html>` and the document head in dev.** Recommend: a full reload. The remount swaps `<body>` only. Alternative: remount the head and root attributes too.
12. **Vite's HMR client.** Recommend: the dev loader module imports `/@vite/client`, so Nitro's page and the fallback's page both get it with no HTML change. Not run yet. Alternatives: the fallback runs `transformIndexHtml` and Nitro's page has no HMR; the server injects the script when `DEV` (it would need a dev branch in `renderToStream`).
13. **Skew under Nitro.** Measured: `build.js` is served `immutable` unless a route rule says `no-store`, and Nitro empties `.output/public`, so the previous build's files are not kept. Recommend: the config carries the route rule (shown above), and the docs say that the previous-build retention needs a persistent client folder, so a page one build old reloads once, as on a clean Vercel build. Alternatives: the plugin sets the route rule itself when it finds Nitro (no config line, but it writes Nitro options); the plugin turns `skew` retention off under Nitro and says so.
14. **Split of the `todo` files.** Recommend: `app.tsx` is the document and `todo.tsx` stays free of it, so the website demo and the REPL keep showing a component without `<html>`. Alternative: `todo.tsx` renders the document itself.

Dropped from the first revision: the Node adapter (Nitro is the adapter), `vite preview` (e2e runs Nitro's output), and the nonce and policy in the host (`renderToResponse` owns them).

## Where brumate does the same or differently

| Topic                        | Brumate                                                                                                      | This proposal                                                                      | Why                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Document                     | `_layout.brm` renders `<html>`. The server adds the doctype, the head of the components and the scripts.     | Same. The root component renders `<html>`.                                         | The user asked for it.                                                                     |
| Title                        | `<title>` in `#head`, or in the `<head>` of a document component.                                            | `<title>` in the document head, which is the first `<Head>` block.                 | One rule for every head element.                                                           |
| Server                       | Nitro 3 (`nitro/vite`), pinned `3.0.260903-beta`. Hand-written Node server also documented.                  | Nitro 3, same pin. No hand-written server in the docs.                             | The user chose it. Nitro is the adapter, so no `toRequest` or `send`.                      |
| Entry                        | `export default { fetch }` that calls `handleCall`, then `handle(request, { scripts, address })`.            | `export default { fetch }` that calls `renderToResponse`.                          | The same shape. Idlip has no server functions or routes yet.                               |
| Entry convention for Nitro   | `src/entry-server.ts`, found by Nitro.                                                                       | `idlip({ entry })` sets the ssr input; Nitro serves it. Measured.                  | Dev answered 404 until the ssr input was set.                                              |
| Client input in the config   | `client: { build: { rollupOptions: { input: 'src/client.ts' } } }`, read in the entry with `?assets=client`. | Default `idlip/client`; the loader URL rides in the chunk map.                     | Idlip's loader has no user file. The server gets the URL with no import.                   |
| `render`                     | `render(Root, props, options)` returns `{ html, head, state, pending, headers, status }`.                    | `render` returns `{ head, body, pending, … }`.                                     | The same split: parts first, then a stream. Idlip has no event, so no `headers`, `status`. |
| Stream                       | `renderToStream`, `streamParts`.                                                                             | The same names, built by `render-stream`.                                          | -                                                                                          |
| A component without `<html>` | `start` and `end` strings in `DocumentOptions`.                                                              | Rejected.                                                                          | The user's rule: no HTML strings in user code.                                             |
| Extra markup                 | `scripts` and `head` strings. The entry writes `/@vite/client` when `import.meta.env.DEV`.                   | None. The plugin and `<Head>` supply them. The dev loader imports `/@vite/client`. | Same rule.                                                                                 |
| Client bundles               | The client build writes `.brumate/hints.json`. The server reads it and calls `setClientBundles`.             | A `loader` key in the chunk map baked into the server modules.                     | The chunk map is already baked in. No file and no global.                                  |
| Dev without Nitro            | `vite.ssrLoadModule` in the user's `server.ts`, with `scripts` naming `/@vite/client` and `/src/client.ts`.  | The plugin's fallback middleware calls `fetch`. It stands aside for Nitro.         | The user wrote no dev server.                                                              |
| Request in the render        | `request` option and `getEvent()`.                                                                           | The entry derives props from `request`. No request context in components.          | Routing and data loading are non-goals of this roadmap.                                    |
| CSP                          | `nonce` in the render options; the host writes the policy. Prerendered pages use hashes.                     | `csp: true` makes the nonce, sets the header and uses idlip's policy.              | The user decision: user files hold no policy code.                                         |
| Skew files                   | `skew: { keep: 2 }` keeps old builds in `dist/client`.                                                       | `skew` as today. Under Nitro the previous build is not kept (measured).            | Nitro empties `.output/public`.                                                            |
| Hints                        | `earlyHints` callback, `Link` headers.                                                                       | Unchanged: `renderPreload(..., { format: 'header' })` stays.                       | Outside this node.                                                                         |

## Work after approval

Phase 2 changes, in order: the compiler (title in head, skeleton errors, document flag, state script before `</body>`), the loader root, `loader` in the chunk map, `render`, `renderToResponse` and `csp`, the stream splice, Nitro detection and the fallback middleware, the dev loader's `/@vite/client` import, then every caller: `examples/*`, `benchmarks/idlip/*`, `website/src/demo/build.ts`, the docs (getting started, components, head, deploying, reference, README) and the e2e server start. Tests: a document component renders the doctype, the framework scripts in `<head>`, the state script in `<body>` and the nonce on each; `csp: true` sets the header with the nonce of the page and `extend` adds a directive; a differential subject for a document component; a build with Nitro serves a page whose state script holds the `loader` URL.
