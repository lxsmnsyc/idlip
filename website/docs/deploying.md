---
title: Deploying
order: 26
section: Guide
description: Serve a built app with Node or Vercel, keep cached pages working across deploys, and preload the first click. Also what vite dev does on an edit.
---

This page serves `examples/todo` in production. The Node setup below was run against a build of that example. The page renders under a strict CSP, a click loads its two chunks, and pages from older builds recover as described.

## What the build writes

`vite build` with the `idlip()` plugin builds two environments:

| Path                          | Holds                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| `dist/client/assets/`         | The loader, one file per chunk (`todo.handler.toggle.<hash>.js`), and `build.js`.     |
| `dist/client/.vite/`          | The client manifest, when the config sets `build.manifest`. It names the loader file. |
| `dist/server/entry-server.js` | The server entry, with the chunk URLs of the client build written in.                 |
| `dist/.idlip/`                | The chunk map and the list of kept builds. Not served.                                |

Serve `dist/client` as static files and run `dist/server/entry-server.js` for the pages. Every file in `assets/` except `build.js` has a content hash in its name, so it can be cached for a year.

## Node

The todo entry exports `render(url, { loader, nonce })`, which returns the page HTML. One module renders a page, so the Node server and the Vercel function share it:

```js
// page.js
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render } from './dist/server/entry-server.js';

// The built file of the loader, from the client manifest.
const manifestFile = path.join(import.meta.dirname, 'dist/client/.vite/manifest.json');
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
let loader = '';
for (const item of Object.values(manifest)) {
  if (item.isEntry && item.name === 'loader') {
    loader = `/${item.file}`;
  }
}

function getPolicy(nonce) {
  return [
    "default-src 'none'",
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    "base-uri 'none'",
    "require-trusted-types-for 'script'",
    'trusted-types idlip',
  ].join('; ');
}

export default async function handlePage(request, response) {
  const nonce = randomBytes(16).toString('base64');
  const html = await render(request.url ?? '/', { loader, nonce });
  response.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': getPolicy(nonce),
  });
  response.end(html);
}
```

The server sends the assets and the page:

```js
// server.js
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import handlePage from './page.js';

const assets = path.join(import.meta.dirname, 'dist/client/assets');

async function serveAsset(name, response) {
  const body = await readFile(path.join(assets, name));
  response.writeHead(200, {
    'content-type': 'text/javascript; charset=utf-8',
    // build.js names the build the server runs. Every other file has a hash in its name.
    'cache-control': name === 'build.js' ? 'no-store' : 'public, max-age=31536000, immutable',
  });
  response.end(body);
}

async function handle(request, response) {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost');
  const asset = /^\/assets\/([\w.-]+\.js)$/.exec(pathname);
  if (asset !== null) {
    await serveAsset(asset[1], response);
  } else if (pathname === '/') {
    await handlePage(request, response);
  } else {
    response.writeHead(404).end();
  }
}

createServer((request, response) => {
  handle(request, response).catch(() => {
    response.writeHead(404).end();
  });
}).listen(Number(process.env.PORT ?? 3000));
```

```bash
pnpm exec vite build
node server.js
```

A missing asset answers 404, which the loader treats as a failed chunk. A CDN may cache the page itself. The next section covers a cached page that outlives its build.

## Vercel

Serve `dist/client` as the static output and run `page.js` as a function:

```js
// api/page.js
export { default } from '../page.js';
```

```json
{
  "buildCommand": "vite build",
  "outputDirectory": "dist/client",
  "rewrites": [{ "source": "/", "destination": "/api/page" }],
  "functions": {
    "api/page.js": { "includeFiles": "dist/client/.vite/manifest.json" }
  },
  "headers": [
    {
      "source": "/assets/build.js",
      "headers": [{ "key": "Cache-Control", "value": "no-store" }]
    }
  ]
}
```

- **`includeFiles`** ships the client manifest with the function, since `page.js` reads it to find the loader.
- **Each Vercel deployment builds from a clean checkout**, so it keeps no files of the previous build. A page cached from the last deployment reloads once at its first event that needs a chunk. The next section explains why.

## Cached pages after a deploy

A page names the chunk files of the build that rendered it. After a deploy, a page held in a CDN, a back-forward cache or an open tab can ask for files of an older build. The `skew` option of `idlip()` handles it, and it is on by default:

- **The previous build stays.** The client build keeps the files of the build before it and deletes older ones. A page one build old works with no reload.
- **A page two builds old reloads once.** When a chunk fails to load, the loader imports `build.js`, which names the build the server runs. When the page's build differs, the page reloads, once per build and tab. The reload starts from the server's current state, and the click that failed is not run again.
- **No loop.** If the reload gets the old page again, for example from a cache, the tab stays and the chunk stays failed.

What this needs from the deploy:

- **Serve `build.js` with `Cache-Control: no-store`** or a short max age. A cached copy names an old build, so the page never learns of the new one.
- **Keep `dist` between deploys.** The list of kept builds is `dist/.idlip/builds.json`. A deploy from a clean checkout keeps nothing, unless it restores `dist` from the last deploy first.
- **Only build files are deleted.** Files copied from `publicDir` stay.

To turn it off, pass `idlip({ skew: false })`. A failed chunk then never reloads the page.

## Preload the first click

By default the page loads the document and the loader, and the first click waits one round trip for its chunks. `renderPreload` from `idlip/server` names those chunks so the browser fetches them with the page. It is off by default.

```ts
import { renderListener, renderPreload } from 'idlip/server';
import * as compiled from './todo.idlip.tsx';

type PreloadArgs = Parameters<typeof renderPreload>;

// The server build of a *.idlip.tsx module exports `chunks` and `manifest`, but its type
// has only the default export.
const chunks = Reflect.get(compiled, 'chunks') as PreloadArgs[0];
const manifest = Reflect.get(compiled, 'manifest') as PreloadArgs[1];

export function renderHead(nonce: string): string {
  return renderPreload(chunks, manifest, { nonce }) + renderListener({ nonce });
}
```

For the todo page it writes two `<link rel="modulepreload">` tags, for the `toggle` handler and the `todos.*.done` binding. With them, the first click on a checkbox makes no request.

- **Gain.** In the prefetch benchmark at 150 ms round trip time, click to updated page went from 221 ms to 60 ms (medians).
- **Cost.** Two more requests at load, under 1 kB gzip for the todo page, also for visitors who never click. The load event comes about 20 ms later.
- **103 Early Hints.** `renderPreload(chunks, manifest, { format: 'header' })` returns a `Link` header value. It reads only the manifests, not the page, so it can go out before the page renders.
- **Children.** Pass the manifests of child modules too, as an array, or their handlers are not named.
- **Types.** An app cannot import `chunks` and `manifest` with types yet, hence the `Reflect.get` above.

See [idlip/server](./reference/server.md#renderpreload) for the options.

## The dev server

`vite` with the plugin's `entry` option renders pages through the server entry. When you save a `*.idlip.tsx` file, the page updates and keeps its model:

- **A handler or binding edit swaps chunks.** The next time the loader needs a changed chunk, it imports the new one. The page and its model stay as they are.
- **A markup edit remounts.** The loader waits for pending events and keeps the model of each component. It fetches the page again and patches it to the kept models. Child components keep their models, and their props come from the new render. Subscriptions start again.
- **An edit that does not compile** reloads the page, which then shows the server's compile error.

A production build holds none of this code.
