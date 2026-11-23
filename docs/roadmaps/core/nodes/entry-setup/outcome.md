# Outcome: entry-setup

## Built

- **A component renders the whole document.** A view may return `<html>` with one `<head>` and one `<body>`. Any other `html`, `head` or `body` is `document-element-misplaced`. `<title>` is allowed in the document head. A head with no hole stays plain markup, and one with a hole is the first `<Head>` block. `manifest.document` marks the module, `manifest.documentRoot` marks a bound attribute on `<html>` or `<body>`. Change requests: `contracts/compiled-format-document`, `view-ir-document` and `core-api-entry-setup`.
- **`idlip/server`.** `render()` returns the parts of the first render plus `pending` (`RenderResult`, with new `document` and `loader`), and `renderPage` and the string `render` are gone. `renderToStream` and `streamParts` need a document component and write the whole page: the head output at the start of `<head>`, the listener, the preload links and the loader script at its end, the state script before `</body>`. `renderToResponse(component, props, options)` returns a `Response`, rejects before any header, and takes `csp: true | { extend }`, `nonce`, `status` and `headers`. `csp` makes a nonce, writes it on every script and link the server adds, and sets idlip's policy (not in development).
- **The plugin.** The entry is `export default { fetch(request) }`. The loader URL rides in the chunk map of each server module under `loader` (built file in a build, `<base>@id/idlip/client` in dev), so no user code reads a manifest. The dev middleware calls the entry's `fetch`, stands aside when the config has a plugin named `nitro:main`, and has the option `server: false`. The dev loader module imports `/@vite/client`. An edit that changes the shell of a document (`<html` to `<body`) sends `full-reload`.
- **The loader.** `HAS_DOCUMENT` (only with a bound `<html>` or `<body>`) roots the page at `<html>`, and the patch index counts the bindings of the root element. The todo loader file is byte-identical to the one before this node.
- **Examples with Nitro 3** (`nitro@3.0.260903-beta`, the version brumate pins): `todo`, `counters` and `counters-subs` render the document, export a default `fetch`, and run `vite dev` and `node .output/server/index.mjs`. The config carries the `build.js` `no-store` route rule. The website demo calls the entry's `fetch`. The benchmark apps export `page()` for the harness, which reads `renderToStream` to a string, and only build.
- **`idlip/testing`.** `mount` takes a document component: `<body>` is the root, the head elements go in the document head.
- **Docs.** README and `packages/idlip/README.md` (identical), getting started, components, views, resuming, head, deploying (Node, Vercel, Cloudflare, policy, skew under Nitro), the reference for `idlip/server`, `idlip` and `idlip/vite`.

## Acceptance

- `examples/todo` renders the document from `todo.tsx`, and its entry has no HTML string and no manifest read: pass. e2e passes in dev (Nitro, and the plugin middleware) and on Nitro's Node output: 28 passed on ports 48881 to 48884.
- A test renders a document component and checks the doctype, the framework scripts in `<head>`, the state script in `<body>` and the nonce on each script: `test/server/stream.test.ts`, `test/server/response.test.ts`: pass.
- A differential subject covers a document component with a bound `lang`, `class` and head, and fails without the root fix: pass.
- Docs show the new setup, the website builds (29 pages), `check:samples` 0 problems: pass.

## Deviations

- **No `app.tsx` wrapper in `examples/todo`.** The proposal's `app.tsx` renders `TodoApp` as a child. A stateful child turns on `HAS_CHILDREN`, which took the todo loader from 4087 to 4944 B gzip, over the 4096 B budget. `todo.tsx` renders the document itself, so decision 14 of the proposal (a separate `app.tsx`) is not followed. The user should confirm.
- **The state script is `i-state="document"` only when `<html>` or `<body>` has a bound attribute** (`documentRoot`), not for every document. The proposal's decision 9 set it for all. The budget had 9 B of room. A document with static attributes roots the page at `<body>` as before.
- **A markup edit of a document remounts when the shell is unchanged.** Proposal decision 11 reloaded on any edit of a document, which in the todo example (the view is the document) lost the model on every edit. Only a change from `<html` to `<body` reloads.
- **A `<style>` in a document head** stays markup (static text, no hole), and has no nonce, so `csp` needs `style-src` for it. A `<script>` there is the error `document-head-script`. The change request first said both were errors. The rows benchmark needs a `<style>`.
- **The benchmark `page()` reads `renderToStream` to a string**, not `renderToResponse().text()`. The `Response` path encoded and decoded the page, which cost 9% of dashboard SSR throughput in the harness (4592 to 4169 renders/s over six interleaved runs). The stream read to a string is the same as before (below).
- **`e2e/fixture/server.ts` and `website/src/repl/frame-document.ts`** still write a document string around a fragment and a stub loader. They are test and tool pages, not entries. The e2e `fixture` target (`E2E_TARGET=fixture`) fails in this branch (`page error: Cannot read properties of undefined (reading 't')` in the stub loader). With the old `reference.ts` it fails the same way, and nothing in its path changed, so it is stale, not caused by this node. The default `example` target is the one CI runs.

## Gotchas

- **Nitro and skew.** Nitro empties `.output/public` on each build, so `keepBuilds` keeps no files of the previous build, and it serves `assets/` as `immutable`, so `build.js` needs the route rule. The docs say so. The reload recovery under Nitro was covered by `e2e/tests/skew.spec.ts` against the Node output.
- **Nitro dev needs its own `node_modules/.nitro`.** `e2e/fixture/hot-app.ts` links each package instead of the whole `node_modules`. A symlinked `node_modules` made the dev worker fail to import Vite.
- **The plugin and Nitro both answering** gave a 500 on every dev page before the plugin stood aside.
- **`mount` and a document.** The attributes of `<html>` and `<body>` are not applied (the root is a `<div>`).
- **Head order.** The winning title comes first in `<head>`, then the document's own head elements (`<meta charset>`), then the rest of the `<Head>` output, then the listener, links and loader script. A title from a body `<Head>` thus precedes the document title.
- Cloudflare: the build writes `nodejs_compat` in `wrangler.json`. Neither the Vercel nor the Cloudflare output was deployed or run.
- The three `check:reference` problems (`EventBody`, `EventStep`, `printTemplatesModule` in `reference/compiler.md`) are not from this node.

## Measurements

| Measure                                      | Before                                           | After                                            |
| -------------------------------------------- | ------------------------------------------------ | ------------------------------------------------ |
| Dashboard server HTML (`ssr-ab.mjs size`)    | 102,318 B, gzip 8,629                            | 102,340 B, gzip 8,646                            |
| Dashboard state script                       | 69,733 B, gzip 4,874                             | 69,745 B, gzip 4,886                             |
| Todo server HTML, nonce set                  | 5,132 B, gzip 2,106                              | 5,150 B, gzip 2,137                              |
| Todo loader (`gzip -9`, the file)            | 4,087 B                                          | 4,087 B (same file)                              |
| Listener (raw)                               | 1,698 B                                          | 1,698 B                                          |
| Dashboard SSR, renders/s, 6 interleaved runs | 4,653 4,586 4,734 4,282 4,469 4,449 (mean 4,529) | 4,626 4,627 4,675 4,590 4,472 4,243 (mean 4,539) |

- The dashboard difference is `lang="en"` on `<html>` and `document:!0` in the manifest. The todo difference is `<html lang>`, the nonce on four tags and `document:!0`.
- The loader stays within 4096 B gzip: 4,087 B. It has 9 B of room, so the next loader change needs a flag or a trade.
- SSR throughput: both sides were built from the same machine in one session (the before side from `f3005fb`), interleaved, with the machine busy (load 3 to 9). Within noise.

## Verification

- `pnpm exec oxlint --type-aware`: 0 errors. `pnpm exec oxfmt --check .`: pass. `pnpm typecheck`: pass. `pnpm build`: pass.
- `pnpm --filter idlip test`: 917 passed, 35 skipped. `pnpm --filter website build`, `pnpm --filter website test` (135 passed), `pnpm --filter website check:samples`.
- `pnpm --filter e2e test` with `E2E_PORT=48881 E2E_COUNTERS_PORT=48882 E2E_SUBS_PORT=48883 E2E_HOT_PORT=48884`: 28 passed, including the `hot` run on Nitro and the `hot-fallback` run on the plugin middleware, the skew tests, and the loader budget test.
- `node --test` of the benchmark harness (`count`, `scenarios`, `sides`, `scale`): 16 passed.
- `NITRO_PRESET=vercel` and `NITRO_PRESET=cloudflare-module` built from `examples/todo`.
