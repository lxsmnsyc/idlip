# Log: entry-setup

## Phase 1

- Read the brief, brumate's routing, page-metadata, reference-server, reference-plugin, deploying and `examples/todos/server.ts`, then `server/render.ts`, `server/stream.ts`, the plugin and `website/docs/head.md`.
- Compiler probe: `html`, `head` and `body` compile today, with bound `lang` and `class`. `<title>` in `<head>` is `title-outside-head`. `<html>` in a condition and `<body>` in a `<div>` compile with no diagnostic and would break in a client template.
- Wrote `proposal.md` (cea8a41). The user chose Nitro 3 as the default server (revision bbcad8f). Nitro was checked in a scratch copy: it moves the client output to `.output/public`, empties it on each build, serves `assets/` as `immutable`, and runs the ssr environment in its own worker, so the plugin's dev middleware answered 500 beside it.
- The user approved the proposal on 2026-11-23, every decision as recommended.

## Phase 2

- Order of the commits: the approval note, the change requests, `render` returns the parts and `renderPage` goes away, the compiler and server for a document, `renderToResponse`, the plugin (default-export `fetch`, Nitro, the loader key), the hot shell check and `mount` for a document, the examples with Nitro and e2e, the docs.
- The brief's `app.tsx` wrapper does not fit the todo example: a stateful child turns on `HAS_CHILDREN`, which takes the todo loader from 4087 to 4944 B gzip, over the 4096 B budget. `todo.tsx` renders the document itself. Counters and counters-subs already have children, so their `board.tsx` renders it.
- The loader budget had 9 B of room. A `HAS_DOCUMENT` flag (a bound attribute on `<html>` or `<body>`) guards the two places that need the document root, and the todo loader is the same file as before the change (4087 B, hash `DejSiby1`). A first version with a `getRoot` function grew it to 4091 B, so the two uses are inline.
- A document `<head>` with no hole stays plain markup, so the todo loader needs no `HAS_HEAD` code (+307 B). A head with a hole is the first `<Head>` block.
- Head order, after review: the winning title first, then the document's own head elements, then the rest of the `<Head>` output, then the listener, the preload links and the loader script. A first version wrote all head output before the document's head elements.
- The patch index (`buildIndex`) walked from the root's children, so `<html i-a>` was never indexed. The differential test found it: a `document` subject with a bound `lang` fails without the fix. The walker now starts at the root when `HAS_DOCUMENT` is on. The differential harness loads a document subject into its own document for each pair, since the patch keeps the nodes it found for a root.
- `mount` of `idlip/testing` takes a document component: `<body>` is the root, the head elements go in the document head, and `stop` removes them.
- Nitro in dev: its worker runs from `node_modules/.nitro`. The hot e2e copy symlinked the whole `node_modules`, and Nitro wrote paths relative to the real folder, so the dev worker failed to import Vite. `hot-app.ts` now links each package and keeps its own `.nitro`.
- The e2e `hot` run (Nitro) and a new `hot-fallback` run (no `nitro()`, the plugin's middleware) both pass, with the HMR socket carrying `idlip:hot`, so the dev loader's `/@vite/client` import works under both. A `<title>` edit in the hot test loads the page again.
- A markup edit of a document used to remount (it keeps the model). The first version reloaded on any edit of a document, which lost the model in the todo example, since the whole view is the document. `changesShell` compares the render code from `<html` to `<body`, and only a change there reloads.
- Vercel and Cloudflare presets: both built from `examples/todo` with `NITRO_PRESET=vercel` and `cloudflare-module`. The Vercel config carries `build.js` as `no-store` and the rest as `immutable`. The Cloudflare build writes `_headers` with the same, and `wrangler.json` with `nodejs_compat`. Neither was deployed.
- The benchmark apps keep `page(...)` for the harness, now over `renderToResponse` and `text()`. The generators of the dashboard and the scale apps wrap the root in `<html>`. A `<style>` in a document head cannot hold a hole, so the rows app writes its CSS with `&#123;` and `&#125;`.
- The e2e golden fixture server (`e2e/fixture/server.ts`) and the REPL frame (`website/src/repl/frame-document.ts`) still write a document string. They are test and tool pages around fragments and a stub loader, not entries.
- No new changeset: the one changeset is the first release, and the package is `0.0.0`.
