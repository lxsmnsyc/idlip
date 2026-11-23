# Outcome: preimport-chunks

## Built

- **Typed manifest access.** `renderPage` returns `chunks` (the state's chunk URLs, children included, without `build`) and `manifests` (the root's, then the child manifests), the two arguments of `renderPreload`: `renderPreload(page.chunks, page.manifests)`. Both are frozen copies made once per cached static part of `server/render.ts`, so every render of a module returns the same read-only objects (a copy, since seroval writes a frozen object with `Object.freeze`). `idlip/server` exports the types `ChunkUrls` and `Manifest`. No compiler or loader change. Change request `contracts/core-api-render-preload.change-request.md`.
- **Wiring.** `examples/todo` renders the links by default (with the page nonce); `?preload=off` leaves them out. The benchmark todos, rows and dashboard pages render them through `page(..., preload = true)`; the dashboard names 20 chunks (`max: 20`, the 4 widgets above the fold; the default 8 covered widget 0 and half of widget 1, so the harness click on widget 1 still fetched 2 files). `serve.mjs` passes `?preload=off` to the todos and rows pages, and the dashboard adapter has `preloadOption: true`. `benchmarks/prefetch/run.mjs` uses the app's own links instead of building them from the state script. The scale page keeps no links (see Sizes).
- **Harness.** `benchmarks/harness/first-click-ab.mjs`: interleaved first click after idle (the waterfall's idle run) between `--side name=<dist>[:off]` builds (`sides.mjs` splits on the first `=`; `sides.test.mjs`), warmup dropped, 3 x MAD noise, load printed at start and end, try/finally cleanup. It reports the harness's click-to-update and two page-clock times from the click event: to the first DOM change and to the frame after it. `measureFirstClick` is exported from `browser.mjs`.
- **Tests.** `test/server/render.test.ts`: `renderPage` returns the chunk URLs without `build`, the child manifests, both frozen. e2e: the loading-path tests use `/?preload=off`; new tests: the preloads (helpers, toggle, binding) and a first click with no request and no CSP violation; a click before the preloads arrive applies and each chunk is fetched once (the loader's imports reuse the preloads in flight); the helpers-fail-once test runs with and without links.
- Docs: `website/docs/deploying.md` (the wiring example uses `renderPage`, no more `Reflect.get`; read-only values; scripts off; the `Link` header under a nonce policy), `resuming.md`, `reference/server.md` (`RenderResult`, `ChunkUrls`, `Manifest`); `benchmarks/README.md`.

## Dropped: import the preloaded modules at idle

Built and measured, then removed at review: plugin option `preimport` (default off), flag `HAS_PREIMPORT`, `client/preimport.ts`. After `load`, at `requestIdleCallback`, it called the loader's `load(href)` for every `<link rel="modulepreload">`, as brumate `af923d74` does, so the click would await settled promises.

- It moved the DOM write, not the frame. First click after idle, 150 ms latency, N = 21 per side, load 2.24 to 2.25, median (MAD), against the links-only build:

| Metric          | Todos links | Todos preimport          | Dashboard links | Dashboard preimport      |
| --------------- | ----------- | ------------------------ | --------------- | ------------------------ |
| Click to update | 66.0 (2.0)  | 73.0 (5.0), within noise | 68.0 (5.0)      | 72.0 (5.0), within noise |
| Click to write  | 15.9 (0.2)  | 2.9 (0.2), real          | 17.6 (0.6)      | 4.6 (0.4), real          |
| Click to frame  | 31.3 (0.2)  | 28.0 (1.4), within noise | 31.7 (0.2)      | 28.9 (1.7), within noise |

An earlier run with the harness number only (load 2.2 to 4.8) also had preimport within noise and slower: todos 67 against 80 ms, dashboard 70 against 81 ms. In these runs the frame came about 25 ms after a write made inside the click task, so the earlier write mostly waited for the same frame in headless Chrome.

- Cost: +86 B gzip on the todo loader (4044 to 4130 B, over the 4096 B budget) and +91 B on the dashboard loader (4880 to 4971 B). A first version with a `document.readyState` check cost +108 B.
- Risks of the design: it imported every modulepreload of the page, so third-party modules ran early; a relative `href` resolved against the loader's URL, not the page's; and a 404 on a foreign preload went through `load`'s failure path and could start the skew check.

## Sizes

Node `zlib.gzipSync` level 9 on the built loader file from an empty `dist`, as the e2e test measures. The loader is unchanged: todo 4044 B, dashboard 4880 B, identical files to `batch/core`.

Links: the todo page preloads 3 files (helpers, `handler=toggle`, `binding=todos.*.done`), the bench todos page 3, the rows page 9, the dashboard 21. Scale: with the default 8 links, JS before `load` was 7.5 kB gzip at every size (flat) instead of 5.0 kB, and the clicked widget was still not covered (the first click still fetched 0.6 kB). The scale page measures startup, so it keeps no links: its numbers are unchanged (`node benchmarks/harness/scale.mjs run --only idlip --bytes-only`: JS before `load` 5.0 kB at 10, 50, 200 and 1,000 widgets).

## Proof

First click after 1,000 ms idle at 150 ms latency, `first-click-ab.mjs`, N = 21 per side fixed before the run, one warmup dropped. Apple M2, 8 cores, Chrome 158. Load 2.24 at the start, 2.25 at the end of each scenario. Median (MAD). The "links" side is the links-only build that ships; the "off" side served the same pages without links (its build had the dropped idle import, which does nothing without links).

| Todos, counter  | off         | links      | change                 |
| --------------- | ----------- | ---------- | ---------------------- |
| Requests        | 3           | 0          |                        |
| Click to update | 232.0 (4.0) | 66.0 (2.0) | -72%, noise 12.0, real |
| Click to write  | 185.0 (2.1) | 15.9 (0.2) | real                   |
| Click to frame  | 186.1 (2.0) | 31.3 (0.2) | real                   |

| Dashboard, widget 1 | off         | links      | change                 |
| ------------------- | ----------- | ---------- | ---------------------- |
| Requests            | 4           | 0          |                        |
| Click to update     | 247.0 (4.0) | 68.0 (5.0) | -72%, noise 15.0, real |
| Click to write      | 194.9 (2.1) | 17.6 (0.6) | real                   |
| Click to frame      | 196.9 (3.2) | 31.7 (0.2) | real                   |

`node benchmarks/prefetch/run.mjs --rounds 20 --no-build` (load 2.61 to 2.80): off 227 ms (224-234), on 60 ms (53-66); navigation to update 617 against 489 ms; `load` 389 against 432 ms.

Commands: build `benchmarks/idlip` (`build`, `build:dashboard`), copy each `dist` away, then `node benchmarks/harness/first-click-ab.mjs --scenario todos|dashboard --runs 21 --side links=<dist> --side off=<dist>:off`. The README has the same. The A/B was not rerun after the removal: the load was 5.0 when it was checked, and the links side is the same build.

## Decision

Links on in `examples/todo` and the benchmark pages: one round trip (232 and 247 ms) to no request (66 and 68 ms), in range of brumate 0.8.1 (83 and 56 ms) and Marko (44 and 47 ms) on the same loading choice. Cost: the first click's chunks on every load, and `load` about 40 ms later on the throttled todos page. The idle import was dropped (see above).

## Deviations

- `packages/idlip/src/server/render.ts` and `server/index.ts`, outside the shared paths: the typed access needed a change to `renderPage`. Also `test/server/**`, `website/docs/**`.
- The scale page has no links, so its headline metric is unchanged rather than "flat with links".
- The brief's step 2 (idle import) was built and then removed at review; the finding is above.

## Stubs left

- None.

## Gotchas

- With scripts off Chromium cancels module preloads, and the e2e `problems` fixture counts each as a failed request: the scripts-off test uses `/?preload=off`.
- A `Link: <url>; rel=modulepreload` header on the page response loaded in Chrome 158 under `script-src 'nonce-…' 'strict-dynamic'` with no violation, and a later nonce'd `import()` reused it (one request). 103 Early Hints (HTTP/2 only in Chrome) and other browsers were not tested.
- `renderPreload`'s default cap of 8 covers less than two dashboard widgets; pass `max` for pages with many children.
- Early Hints need one render to get `page.chunks` and `page.manifests`; keep them from the first render.

## Proposed learnings

- Time a first click with the page's clock too | the Playwright click and poll add about 50 ms that hides a 13 ms change in the write | benchmarks/harness | yes (`first-click-ab.mjs`)
- An import at idle of preloaded chunks moves the DOM write, not the frame, in headless Chrome | write 16 to 3 ms, frame 31 to 28 ms within noise, for 86 B of loader | packages/idlip/src/client | no

## Verification

After the review fixes, on `batch/core` f3ba72d:

- `pnpm --filter idlip build && pnpm --filter idlip test`: 71 files, 816 passed, 29 skipped. `tsc --noEmit` in `packages/idlip`: clean.
- `pnpm --filter website build` (28 pages), `test` (135 passed), `check:samples` (49 samples, 42 live, 0 problems), `check:reference` (105 exports, 0 problems), `typecheck`: clean.
- e2e after `pnpm -r --filter "./examples/*" build`: `E2E_PORT=48681 E2E_COUNTERS_PORT=48682 E2E_SUBS_PORT=48683 E2E_HOT_PORT=48684 pnpm -C e2e test`, 27 passed. e2e `typecheck` clean.
- Benchmark apps: `build`, `build:rows`, `build:dashboard`, `build:scale` exit 0; the todo and dashboard loader files are identical to `batch/core` (4044 B, 4880 B). `pnpm -C benchmarks/harness test`: 16 passed.
- `rtk proxy pnpm lint`: exit 0. `pnpm exec oxfmt --check .`: clean.

## Size

- Estimated M, actual M.
