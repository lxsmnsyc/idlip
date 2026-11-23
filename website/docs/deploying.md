---
title: Deploying
order: 26
section: Guide
description: Build a server with Nitro for Node, Vercel or Cloudflare, send a content security policy, keep cached pages working across deploys, and preload the first click. Also what vite dev does on an edit.
---

This page serves `examples/todo` in production with [Nitro](https://nitro.build) 3. The Node build below was run against that example. The page renders under a strict CSP, a click loads its two chunks, and pages from older builds recover as described. The Vercel and Cloudflare presets were built, and not deployed.

## What the build writes

`vite build` with `idlip()` and `nitro()` builds the client environment, the ssr environment and Nitro's server:

| Path                          | Holds                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| `.output/public/assets/`      | The loader, one file per chunk (`todo.handler.toggle.<hash>.js`), and `build.js`.                    |
| `.output/server/index.mjs`    | The Node server. It serves `.output/public` and calls the `fetch` of the entry for every other path. |
| `.output/server/_ssr/ssr.mjs` | The server entry, with the chunk URLs and the loader URL of the client build written in.             |
| `dist/.idlip/`                | The chunk map and the list of kept builds. Not served.                                               |

Every file in `assets/` except `build.js` has a content hash in its name, so Nitro serves it with `cache-control: public, max-age=31536000, immutable`. The server reads no manifest: the URL of the loader is in the server entry, which the page writes as its script tag.

## Node

The todo entry answers each request with the page. It holds no policy code:

```ts
// src/entry-server.ts
import { renderToResponse } from 'idlip/server';
import TodoApp from './todo.tsx';

const server = {
  async fetch(): Promise<Response> {
    return renderToResponse(TodoApp, { initial: [] }, { csp: true });
  },
};

export default server;
```

Build and run:

```bash
pnpm exec vite build
PORT=3000 node .output/server/index.mjs
```

The config names the entry and adds Nitro:

```ts
// vite.config.ts
import { idlip } from 'idlip/vite';
import { nitro } from 'nitro/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    idlip({ entry: '/src/entry-server.ts' }),
    // The loader asks for build.js to learn which build the server runs, so it must not be cached.
    nitro({ routeRules: { '/assets/build.js': { headers: { 'cache-control': 'no-store' } } } }),
  ],
});
```

A missing asset answers 404, which the loader treats as a failed chunk. A CDN may cache the page itself. The sections below cover the policy and a cached page that outlives its build.

## Vercel

Build for Vercel with the preset:

```bash
NITRO_PRESET=vercel pnpm exec vite build
```

Or set it in the config: `nitro({ preset: 'vercel' })`. Nitro writes `.vercel/output` with the static files, the function `__server.func` and a `config.json` that carries the cache headers, `build.js` with `no-store` included. There is no `vercel.json` and no function file to write. The build log ends with `npx nitro deploy --prebuilt`.

## Cloudflare

```bash
NITRO_PRESET=cloudflare-module pnpm exec vite build
```

Nitro writes `.output/server/index.mjs` as a module worker, `.output/server/wrangler.json` and `.output/public/_headers`, which holds the same cache headers. The server code uses web APIs only (`Request`, `Response`, `crypto` and streams). The worker needs the `nodejs_compat` flag, which Nitro writes in `wrangler.json`.

## Content security policy

`csp: true` of `renderToResponse` makes a nonce for each response, writes it on the listener, the preload links, the loader script and the state script, and sets this header:

```
default-src 'none'; script-src 'nonce-…' 'strict-dynamic'; base-uri 'none'; object-src 'none'; require-trusted-types-for 'script'; trusted-types idlip
```

`default-src 'none'` blocks styles, images and requests, so a page with a stylesheet adds its sources: `csp: { extend: { 'style-src': ["'self'"], 'img-src': ['https:'] } }`. Sources are added to a directive of that name, or the directive is added. The script directives (`script-src`, `script-src-elem`, `script-src-attr`) and the Trusted Types directives (`trusted-types`, `require-trusted-types-for`) cannot be extended. A host that makes its own nonce passes it as `nonce`, and `csp` uses it.

- **No header in development.** The policy would block Vite's HMR socket and error overlay. The nonce is still written, so the markup is the same.
- **The page and its assets are not the same response.** Nitro serves the files of `.output/public` itself, and the policy applies to the page.

## Cached pages after a deploy

A page names the chunk files of the build that rendered it. After a deploy, a page held in a CDN, a back-forward cache or an open tab can ask for files of an older build. The `skew` option of `idlip()` handles it, and it is on by default:

- **A page of an older build reloads once.** When a chunk fails to load, the loader imports `build.js`, which names the build the server runs. When the page's build differs, the page reloads, once per build and tab. The reload starts from the server's current state, and the click that failed is not run again.
- **No loop.** If the reload gets the old page again, for example from a cache, the tab stays and the chunk stays failed.
- **The previous build can stay.** The client build keeps the files of the build before it and deletes older ones, so a page one build old works with no reload. This needs the client folder to persist between builds.

What this needs from the deploy:

- **Serve `build.js` with `Cache-Control: no-store`** or a short max age. A cached copy names an old build, so the page never learns of the new one. The route rule in the config does it. Nitro serves everything in `assets/` as `immutable` otherwise. In the example's Node build, `build.js` answers `no-store` and the other files `immutable`.
- **Keeping the previous build does not work with Nitro as it stands.** Nitro writes the client files to `.output/public` and empties it on each build, so the files of the build before are gone, though `dist/.idlip/builds.json` lists them. A page cached from the last deploy finds its chunks gone and reloads once at its first event that needs a chunk. A Vercel deployment builds from a clean checkout and behaves the same. To keep the files, serve the old build's `assets/` next to the new one, from the CDN or storage.
- **Only build files are deleted.** Files copied from `publicDir` stay.

To turn it off, pass `idlip({ skew: false })`. A failed chunk then never reloads the page.

## Preload the first click

`renderToResponse` writes `<link rel="modulepreload">` tags for the chunks of the first click, so the browser fetches them with the page. For the todo page it writes three: the shared helpers module, the `toggle` handler and the `todos.*.done` binding. With them, the first click on a checkbox makes no request. `examples/todo` leaves them out with `?preload=off`, by passing `preload: false`.

- **Gain.** In the prefetch benchmark at 150 ms round trip time, click to updated page went from 227 ms to 60 ms (medians).
- **Cost.** Three more requests at load, about 1 kB gzip for the todo page, also for visitors who never click. The load event comes about 40 ms later on that throttled page.
- **Options.** `preload: { max: 20, events: ['click', 'input'] }` passes the options of `renderPreload`. `preload: false` turns the links off.
- **103 Early Hints.** `render()` returns `chunks` and `manifests`, and `renderPreload(page.chunks, page.manifests, { format: 'header' })` returns a `Link` header value.
- **Early Hints need a render.** `page.chunks` and `page.manifests` come from a render and are read-only. They are the same for every render of a page, so a server can keep them from the first render and send the header before the next ones.
- **The header under a nonce policy.** A `Link` header carries no nonce. In Chrome 158 a `rel=modulepreload` in the header of the page response loaded under `script-src 'nonce-…' 'strict-dynamic'`, with no violation, and the loader's import reused it. A 103 response (HTTP/2 only in Chrome) and other browsers were not tested.
- **Children.** `page.manifests` holds the manifests of the child modules too, so their handlers are named.
- **Scripts off.** With scripts off, Chromium cancels module preloads. Devtools shows them as failed requests. It is harmless: the page works without scripts as before.
- **No import before the click.** A preload only fetches a module. The click still imports it, which resolves in a task of its own. Importing the preloaded modules at idle after `load` was measured and dropped: the first DOM write came 13 ms sooner, but the frame that shows it did not move beyond the noise, for 86 B gzip of loader.

See [idlip/server](./reference/server.md#renderpreload) for the options.

## Stream the page

`renderToResponse` streams. The first chunk is the whole first render: the head with the listener, the preload links and the loader script, the body and the state script. Chunks for data that resolves later follow it.

- **A render error rejects before any header.** `renderToResponse` renders and reads the first chunk before it makes the `Response`, so the entry can catch the error and answer 500.
- **A component that does not render `<html>` rejects too**, with a `TypeError`.
- **Cancelling the response stops the pending work.** The stream aborts the `signal` of the render and closes the pending chunks.
- **`pending` is single-use.** A second `streamParts` on the same `render` result streams the first render again, with no pending chunks, since the first stream consumed them.

For a host that sends its own `Response`, `renderToStream(TodoApp, props, { nonce })` returns the document as a `ReadableStream<string>`, and `streamParts(parts)` streams the result of `render`.

## The dev server

`vite dev` serves the pages through Nitro, which calls the same `fetch` as production. When you save a `*.tsx` file, the page updates and keeps its model:

- **A handler or binding edit swaps chunks.** The next time the loader needs a changed chunk, it imports the new one. The page and its model stay as they are.
- **A markup edit of the body remounts.** The loader waits for pending events and keeps the model of each component. It fetches the page again and patches it to the kept models. Child components keep their models, and their props come from the new render. Subscriptions start again.
- **An edit of `<html>` or of the head loads the page again.** A remount swaps `<body>` only, so the page starts from the server's state.
- **An edit that does not compile** reloads the page, which then shows the server's compile error.
- **Vite's client rides with the loader.** The dev loader module imports `/@vite/client`, so the page has no markup for it.
- **No policy and no `immutable`.** `csp: true` writes the nonce and sends no header in development.

Without `nitro()` in the config, the plugin's own middleware calls the same `fetch` in `vite dev`. A production build holds none of this code.
