# Outcome: preimport-chunks

## Built

- **Typed manifest access.** `renderPage` returns `chunks` (the state's chunk URLs, children included, without `build`) and `manifests` (the root's, then the child manifests), the two arguments of `renderPreload`: `renderPreload(page.chunks, page.manifests)`. They come from the cached static part of `server/render.ts`, so they are the same objects for every render of a module. No compiler change. Change request `contracts/core-api-preimport.change-request.md`.
- **Wiring.** `examples/todo` renders the links by default (with the page nonce); `?preload=off` leaves them out. The benchmark todos, rows and dashboard pages render them through `page(..., preload = true)`; the dashboard names 20 chunks (`max: 20`, the 4 widgets above the fold; the default 8 covered widget 0 and half of widget 1, so the harness click on widget 1 still fetched 2 files). `serve.mjs` passes `?preload=off` to the todos and rows pages, and the dashboard adapter now has `preloadOption: true`. `benchmarks/prefetch/run.mjs` uses the app's own links instead of building them from the state script.
- **Idle import.** Plugin option `preimport` (default off) sets a new flag `HAS_PREIMPORT`, like `skew`. `client/preimport.ts`, one call site in `resume()`: after `load`, at `requestIdleCallback` (or `setTimeout`), it calls the loader's `load(href)` for every `<link rel="modulepreload">` of the document, so the click awaits settled promises from the same memo. The todo example leaves it off (loader budget); the benchmark todos, rows and dashboard builds turn it on, and `IDLIP_PREIMPORT=0` builds without it.
- **Harness.** `benchmarks/harness/first-click-ab.mjs`: interleaved first click after idle (the waterfall's idle run) between `--side name=<dist>[:off]` builds, warmup dropped, 3 x MAD noise, load printed at start and end, try/finally cleanup. It reports the harness's click-to-update and two page-clock times from the click event: to the first DOM change and to the frame after it. `measureFirstClick` is exported from `browser.mjs`.
- **Tests.** `test/client/loader/preimport.test.ts` (nothing runs before `load`; after it the preloaded chunks run and the click imports nothing more). `test/server/render.test.ts` (`renderPage` returns the chunk URLs without `build` and the child manifests). `test/vite/features.test.ts` (the define defaults to `false`; the todo client build holds the idle import only with the option). e2e: the loading-path tests use `/?preload=off`; new test "the preload links fetch the first click chunks with the page, so the click fetches nothing" (helpers, toggle and binding preloaded, 0 requests at the click, no CSP violation under the nonce policy).
- Docs: `website/docs/deploying.md` (the wiring example now uses `renderPage`, no more `Reflect.get`), `resuming.md`, `reference/server.md`, `reference/vite.md`; `client/CLAUDE.md`, `vite/CLAUDE.md`; `benchmarks/README.md`.

## Sizes

Node `zlib.gzipSync` level 9 on the built loader file from an empty `dist`, as the e2e test measures.

| Loader                     | Base 6918353 | Branch, `preimport` off | Branch, `preimport` on |
| -------------------------- | -----------: | ----------------------: | ---------------------: |
| `examples/todo`            |       4044 B | 4044 B (identical file) |       4130 B (+86 B)\* |
| Benchmark todos            |       4044 B |                       - |         4130 B (+86 B) |
| Benchmark dashboard        |       4880 B |                       - |         4971 B (+91 B) |
| Benchmark scale (no links) |       4880 B |        4880 B (as base) |                      - |

\* Measured with the option on temporarily; the committed todo example leaves it off, so the e2e budget test sees 4044 B. A first version with a `document.readyState` check cost +108 B; the check is not needed, since a loader script in the markup delays `load`.

Links: the todo page preloads 3 files (helpers, `handler=toggle`, `binding=todos.*.done`), the bench todos page 3, the rows page 9, the dashboard 21. Scale: with the default 8 links, JS before `load` was 7.5 kB gzip at every size (flat) instead of 5.0 kB, and the clicked widget was still not covered (the first click still fetched 0.6 kB). The scale page measures startup, so it was reverted to no links and no `preimport`: its numbers are unchanged (`node benchmarks/harness/scale.mjs run --only idlip --bytes-only`: JS before `load` 5.0 kB at 10, 50, 200 and 1,000 widgets).

## Proof

First click after 1,000 ms idle at 150 ms latency, `first-click-ab.mjs`, N = 21 per side fixed before the run, one warmup dropped. Apple M2, 8 cores, Chrome 158. Median (MAD). Sides: off (no links), links (links, loader without `preimport`), preimport (links and `preimport`).

Run 2, load 2.24 at the start and 2.25 at the end of both scenarios:

| Todos, counter  | off         | links      | preimport  | preimport vs links         |
| --------------- | ----------- | ---------- | ---------- | -------------------------- |
| Requests        | 3           | 0          | 0          |                            |
| Click to update | 232.0 (4.0) | 66.0 (2.0) | 73.0 (5.0) | +10.6%, noise 15.0, within |
| Click to write  | 185.0 (2.1) | 15.9 (0.2) | 2.9 (0.2)  | -81.8%, noise 0.6, real    |
| Click to frame  | 186.1 (2.0) | 31.3 (0.2) | 28.0 (1.4) | -10.5%, noise 4.2, within  |

| Dashboard, widget 1 | off         | links      | preimport  | preimport vs links        |
| ------------------- | ----------- | ---------- | ---------- | ------------------------- |
| Requests            | 4           | 0          | 0          |                           |
| Click to update     | 247.0 (4.0) | 68.0 (5.0) | 72.0 (5.0) | +5.9%, noise 15.0, within |
| Click to write      | 194.9 (2.1) | 17.6 (0.6) | 4.6 (0.4)  | -73.9%, noise 1.8, real   |
| Click to frame      | 196.9 (3.2) | 31.7 (0.2) | 28.9 (1.7) | -8.8%, noise 5.1, within  |

Run 1 (harness metric only, before the page-clock metrics were added; load 2.80 to 4.75 for todos, 2.21 to 3.81 for the dashboard, so partly above 3): todos links 67.0 (5.0), preimport 80.0 (10.0), off 238.0 (7.0); dashboard links 70.0 (5.0), preimport 81.0 (11.0), off 245.0 (4.0). Preimport within noise both times, trending slower.

`node benchmarks/prefetch/run.mjs --rounds 20 --no-build` (bench todos build with `preimport`, click right at `load`, load 2.61 to 2.80): off 227 ms (224-234), on 60 ms (53-66); navigation to update 617 against 489 ms; `load` 389 against 432 ms.

Commands: build the sides (`IDLIP_PREIMPORT=0 pnpm run build` and `build:dashboard`, then the default build, each `dist` copied away), then `node benchmarks/harness/first-click-ab.mjs --scenario todos|dashboard --runs 21 --side links=<links dist> --side preimport=<preimport dist> --side off=<preimport dist>:off`. The README has the same.

## Decision

- **Links: on in examples/todo and the benchmark pages.** The gain is far beyond noise: one round trip (232 and 247 ms) to no request (66 and 68 ms), in range of brumate 0.8.1 (83 and 56 ms) and Marko (44 and 47 ms) on the same loading choice. Cost: the first click's chunks on every load, and `load` about 40 ms later on the throttled todos page.
- **Preimport: shipped behind the flag, default off.** It does what brumate `af923d74` did: the DOM write moves from 16 to 18 ms after the click to 3 to 5 ms (real, both pages). The frame that shows it moves 3 ms in the median, inside the noise, and the end-to-end harness number does not move beyond the noise (trends slower in both runs). In these runs the frame came about 25 ms after a write made inside the click task, so the earlier write mostly waits for the same frame in headless Chrome. It does not fit the todo loader budget anyway (4130 B > 4096 B). The benchmark builds keep it on, which matches brumate's loading; the README labels it.

## Deviations

- `packages/idlip/src/server/render.ts`, outside the shared paths: the typed manifest access needed a change to `renderPage`. Also `src/client/features.ts`, `src/client/preimport.ts` (new), `test/**`, `website/docs/**`, `benchmarks/idlip/rows/**`, `benchmarks/idlip/dashboard/**` (inside `benchmarks/idlip/**`).
- Scale page left without links (see Sizes), so its headline metric is unchanged rather than "flat with links".
- The harness metric was extended with page-clock times after run 1 showed preimport within noise on the harness number; both runs are reported in full.
- `pnpm --filter website check:reference` fails on 8 `reference/compiler.md` exports on `batch/core` too; not touched.

## Stubs left

- None.

## Gotchas

- With scripts off Chromium cancels module preloads, and the e2e `problems` fixture counts each as a failed request: the scripts-off test uses `/?preload=off`.
- `preimport` imports every modulepreload link of the page, not only idlip chunks.
- `renderPreload`'s default cap of 8 covers less than one dashboard widget pair; pass `max` for pages with many children.
- Early Hints now need one render to get `page.chunks` and `page.manifests`; keep them from the first render.

## Proposed learnings

- Time a first click with the page's clock too | the Playwright click and poll add about 50 ms of noise that hides a 13 ms change in the write | benchmarks/harness | yes (`first-click-ab.mjs`)
- An import at idle moves the DOM write, not the frame, in headless Chrome | write 16 to 3 ms, frame 31 to 28 ms within noise | packages/idlip/src/client | no

## Verification

- `pnpm --filter idlip build && pnpm --filter idlip test`: 72 files, 819 passed, 29 skipped. `tsc --noEmit` in `packages/idlip`: clean.
- `pnpm --filter website build` (28 pages), `pnpm --filter website test` (118 passed), `pnpm --filter website check:samples` (49 samples, 42 live, 0 problems), website `typecheck` clean.
- e2e after `pnpm -r --filter "./examples/*" build`: `E2E_PORT=48681 E2E_COUNTERS_PORT=48682 E2E_SUBS_PORT=48683 E2E_HOT_PORT=48684 pnpm -C e2e test`, 25 passed (loader budget and website-live included).
- Benchmark apps: `build`, `build:rows`, `build:dashboard`, `build:scale` exit 0. `pnpm -C benchmarks/harness test`: 13 passed.
- `rtk proxy pnpm lint`: 0 errors. `pnpm exec oxfmt --check .`: clean.
- Mutation check: with the `startPreimport(load)` call removed, `preimport.test.ts` fails (times out waiting for the chunks).

## Size

- Estimated M, actual M.
