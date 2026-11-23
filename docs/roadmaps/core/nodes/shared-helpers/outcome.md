# Outcome: shared-helpers

## Built

- **One helpers module.** Chunks no longer copy runtime helpers. A chunk imports the ones it uses, `import { setAttr$, setText$ } from 'idlip/helpers'`. The Vite plugin resolves `idlip/helpers` to the virtual module `\0idlip-helpers`, whose code is `printHelpersModule()` (`core/helpers.ts`, exported by `idlip/compiler`): each helper's `toString()` once, with the loader exports they call imported from `idlip/client`. The bundler keeps the helpers the app uses in one file, `_idlip-helpers.<hash>.js`. `printHelpers` is gone.
- **Loader preload.** `generateBundle` writes the helpers file URL into the chunk map under `helpers` (`HELPERS_KEY` in `core/format.ts`). `render()` keeps it in the state's `chunks`. `getUpdate` (`client/loader/resume.ts`) loads it with the handler chunk and the binding chunks of the event, so the first click is one round trip with 3 parallel requests. `checkChunkImports` allows that one file and checks its own imports against the loader. One round trip holds in a build only: in dev there is no `helpers` key, so the browser fetches the helpers module after the binding chunk that imports it. `renderPreload` names `chunks.helpers` first, outside `max`, whenever it names a chunk.
- **One file per view.** A list or branch chunk imports a child's view by name (`import { init as $init_Row, render as $render_Row }`) and passes `{ init, render }` to `addChild`. The namespace import made the bundler emit each view twice (`counter.view.<hash>.js` re-exporting `counter.tsx_idlip-view_lang.<hash>.js`).
- **idlip/testing and tests.** `importHelpers(key)` (`testing/modules.ts`) runs the helpers module bound to the scope's `client`. `mount`, the differential harness and `helpers.test.ts` use it. `vitest.config.ts` aliases `idlip/helpers` to the helper sources for golden chunks. The loader harness serves the helpers module next to its chunk copies.
- **Website.** A REPL run and a live sample serve `idlip-helpers.js` next to the chunks and point their imports at it (`website/src/repl/chunks.ts`). The REPL output panel and the Compiled tab list it once. `Project.helpers` holds the module text from the worker.
- **New tests.** `test/vite/vite.test.ts` "declares each runtime helper in one file" (todo fixture build, `findCopiedHelpers` in `test/vite/app.ts`). `test/vite/components.test.ts` "ships each view in one file" (fails with the namespace import). `website/test/repl.test.ts`: no chunk of a run copies a helper. e2e `todo.spec.ts` "the first click requests every file before any arrives, so it is one round trip" (fails with the loader preload removed; it compares request timing: every request starts before the earliest response ends). e2e "a helpers module that fails to load once costs at most the first patch". `test/core/helpers-minified.test.ts`: `core/helpers.ts` minified by Vite's bundler throws the rename error, and with `keepNames` writes a working module. `test/server/preload.test.ts`: the helpers URL in the preload. `test/vite/dev-loader.test.ts`: the dev helpers module imports the loader from the URL a chunk does.
- Docs and rules: `compiler/CLAUDE.md`, `client/CLAUDE.md`, `vite/CLAUDE.md`, `website/docs/reference/client.md`, `reference/server.md`. Change request `contracts/compiled-format-shared-helpers.change-request.md`.

## Options measured

| Option                                          |                                                Todo loader gzip | Requests on first click | Verdict                                                                                                                                                             |
| ----------------------------------------------- | --------------------------------------------------------------: | ----------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3. Copy into each chunk (baseline)              |                                                          4035 B |                       2 | dashboard dist 150.4 kB gzip                                                                                                                                        |
| 1. Helpers in the loader                        | 4681 B (loader + helpers module, measured from the built files) |                       2 | over the 4096 B budget by 585 B. The todo app uses `setText$`, `setAttr$`, `setOn$`, `clone$`, `putAttr$`, `putText$`, so no flag can drop them. Not built further. |
| 2a. Real package entry `idlip/helpers` (tsdown) |                                                             n/a |                     n/a | tsdown splits code the entries share into its own files, and the app build then moved the loader's DOM code into a third file the loader imports at boot. Dropped.  |
| 2b. Virtual module, loader preload              |                                                    4063 B (+28) |       3, one round trip | chosen                                                                                                                                                              |

## Sizes

Exact, gzip -9 per file, summed. "Dist" is every `.js` file of `dist/client`.

|                                          |                Base |                Branch |                                             Change |
| ---------------------------------------- | ------------------: | --------------------: | -------------------------------------------------: |
| Todo loader (e2e measure)                |              4035 B |                4063 B |                                              +28 B |
| Dashboard loader                         |              4830 B |                4858 B |                                              +28 B |
| Todo example dist                        |    12 files, 7477 B |      13 files, 6962 B |                                              -6.9% |
| Counters example dist                    |    15 files, 8082 B |      15 files, 7731 B | -4.3% (one view file fewer, one helpers file more) |
| Bench todo dist                          |    13 files, 7712 B |      14 files, 7052 B |                                              -8.6% |
| Rows dist                                |    16 files, 7926 B |      17 files, 7648 B |                                              -3.5% |
| Dashboard dist                           | 364 files, 150.4 kB |   365 files, 104.0 kB |                                             -30.9% |
| Todo `binding=todos.*.done`              |    940 B raw, 505 B |      342 B raw, 233 B |                                                    |
| Rows list chunk                          |   1855 B raw, 984 B |      595 B raw, 349 B |                                                    |
| Helpers module (todo / rows / dashboard) |                none | 927 B / 926 B / 740 B |                                                    |

Harness (`pnpm -C benchmarks/harness bench --scenario todos,dashboard --only idlip --no-build --metrics dist,browser,waterfall`, run on the base and the branch builds; requests and bytes do not depend on load):

| Metric                                     | Base                     | Branch                   |
| ------------------------------------------ | ------------------------ | ------------------------ |
| Todos: first counter click                 | 2 req, 473 B / 351 B     | 3 req, 2.1 kB / 1.1 kB   |
| Todos: first todo toggle                   | 2 req, 997 B / 613 B     | 3 req, 2.2 kB / 1.2 kB   |
| Todos: total JS after counter, toggle, add | 11, 14.7 kB / 7.0 kB     | 12, 13.6 kB / 6.5 kB     |
| Todos: first counter click at 150 ms RTT   | 1 RT, 2 req              | 1 RT, 3 req              |
| Dashboard: first click, widget 1           | 3 req, 1.5 kB / 983 B    | 4 req, 2.3 kB / 1.4 kB   |
| Dashboard: widget 30 after widget 1        | 3, 1.5 kB / 953 B        | 3, 999 B / 699 B         |
| Dashboard: widget 45 after both            | 3, 1.1 kB / 785 B        | 3, 610 B / 530 B         |
| Dashboard: total JS after 3 widgets        | 10, 16.3 kB / 7.4 kB     | 11, 16.3 kB / 7.4 kB     |
| Dashboard: first click at 150 ms RTT       | 1 RT, 3 req              | 1 RT, 4 req              |
| Dashboard: client JS in dist (harness)     | 364, 240.4 kB / 146.9 kB | 365, 150.0 kB / 101.5 kB |

The first click of an app now fetches the app's whole helpers module once: +0.6 kB gzip on the todo toggle, +0.4 kB on the first dashboard widget. Every later chunk is smaller. The dashboard total is even at 3 widgets and lower after that.

## Decision

Option 2b. Option 1 does not fit the loader budget. Option 2b keeps the first click to one network round trip (the waterfall counts 1 RT, and the new e2e test checks that all requests start before the first response), cuts the dashboard dist by 31%, and has the lowest total JS from 3 dashboard widgets on. It reuses the helper sources and the copy rules that existed, as one module instead of one copy per chunk. The cost is a larger first click.

## Timing

Machine: Apple M2, 8 GB, Chrome 158, Node 26.12.1. Base: `batch/core` 13a96a4 builds, copied before any change. Branch: 9045acd builds.

Rows, interleaved A/B. N = 21 fixed before the run, one run, reported in full. Load average 2.74 at the start, 3.32 at the end. `node benchmarks/harness/rows-ab.mjs --dir base=<base> --dir branch=<branch> --runs 21`, click to paint, ms, median (MAD), noise is 3 x the larger MAD:

| Op                 | base        | branch      | Change | Noise | Verdict      |
| ------------------ | ----------- | ----------- | -----: | ----: | ------------ |
| Create 1,000       | 28.1 (2.9)  | 28.7 (5.0)  |  +2.3% |  15.1 | within noise |
| Replace 1,000      | 35.0 (4.4)  | 34.7 (3.8)  |  -0.8% |  13.2 | within noise |
| Append 1,000 to 1k | 57.2 (0.4)  | 57.3 (0.6)  |  +0.1% |   1.7 | within noise |
| Create 10,000      | 245.5 (2.5) | 244.7 (3.9) |  -0.3% |  11.6 | within noise |

Calling a helper from another module costs nothing measurable on rows.

First click at 150 ms RTT (harness `waterfall`, one session per run, not interleaved). `pnpm -C benchmarks/harness bench --scenario todos,dashboard --only idlip --no-build --metrics browser,waterfall`, with the base and the branch builds swapped into `benchmarks/idlip/dist` and `benchmarks/idlip/dashboard/dist`. Two pairs: the first at load 2.49 to 3.35, the second at 3.45 to 3.56 (slightly over 3).

| Metric                                                  | Base, pair 1 / 2           | Branch, pair 1 / 2         |
| ------------------------------------------------------- | -------------------------- | -------------------------- |
| Todos, after idle                                       | 218 / 229 ms (1 RT, 2 req) | 240 / 254 ms (1 RT, 3 req) |
| Todos, cold                                             | 220 / 235 ms               | 239 / 234 ms               |
| Dashboard, after idle                                   | 222 / 250 ms (1 RT, 3 req) | 252 / 240 ms (1 RT, 4 req) |
| Dashboard, cold                                         | 237 / 239 ms               | 248 / 249 ms               |
| Click to update, todos (counter / toggle / add), pair 1 | 60 / 45 / 65 ms            | 74 / 47 / 99 ms            |
| Click to update, dashboard (widget 1 / 30 / 45), pair 1 | 75 / 44 / 46 ms            | 77 / 45 / 47 ms            |

Every first click stays one round trip. The todos first click after idle was 22 and 25 ms slower in both pairs (about +10%); the other first-click numbers move both ways by 10 to 30 ms between runs. The README reads differences under 20% as equal, and these runs are single sessions, so no speed change is claimed. A likely cost is the third request and the module link step (the binding chunk waits for the helpers module), not the 0.6 kB. To settle it, an interleaved A/B of the first click is needed; none exists in the harness yet. Commands to repeat on a quiet machine (both builds in hand, swap them between runs):

```bash
uptime   # 1-minute load under 3
pnpm -C benchmarks/harness bench --scenario todos,dashboard --only idlip --no-build --metrics browser,waterfall
```

## Review fixes

- `packages/idlip/.vitest/json/output.json` was committed by mistake. Removed, and `.vitest/` is ignored.
- `renderPreload` (`server/preload.ts`): the helpers URL first whenever any chunk is named, outside `max`.
- A failed helpers fetch, as Chromium 158 handles it. When the helpers request fails before a binding chunk's static import reaches it, Chromium fetches it again for that import, and the first click applies. When the import waits on the fetch that fails, the binding chunk fails with it and the first patch does not run. The next event asks for the chunk under a new URL (`#1`), Chromium fetches the helpers again (it keeps no failed module fetch), and the patch brings the DOM to the model of both clicks. No loader change was needed. Rule in `client/CLAUDE.md`; Firefox and Safari are not tested.
- `core/helpers.ts`: `HELPERS` is a table of functions by name, without `uses` and `client`. The module imports the four forwarders. The header comment says what a copy may call.
- Minified sources: with the bundler's renaming, `printHelpersModule()` throws `The helper <name> was renamed to <x>`. With `keepNames` it works. The published package is not minified (tsdown, no `minify`).

## Deviations

- The brief's "e2e request-count assertions updated only if option 2 is picked": updated in `todo.spec.ts` and `nested.spec.ts` (a third request, `helpers`), with the one-round-trip test added.
- Files outside the owned paths: `packages/idlip/src/compiler/index.ts` (export), `src/core/format.ts` (`HELPERS_KEY`), `src/testing/**`, `vitest.config.ts`, `e2e/**`, `website/src/repl/**`, `website/src/live/compiled.ts`, `website/test/**`, `website/docs/reference/client.md` and `server.md`. The REPL and live samples serve chunks themselves and had to serve the module.
- The chunk-helpers outcome is another node's file, so its notes stay. The rules moved to `compiler/CLAUDE.md` and `client/CLAUDE.md`.
- No helper body appears twice in the todo fixture build (test) and in the todo example, rows and dashboard builds (checked with a script over the built files). Author code still repeats where two chunks use one module-level function (`countLeft` in todo, widget formatters in the dashboard); that is the module-helper copy rule, not runtime helpers.

## Stubs left

- None.

## Gotchas

- `importHelpers` and the loader harness run the helpers module as text; Node cannot resolve `idlip/client` from `node_modules/.idlip-loader-test`, which is why binding chunks there never loaded before this node. Tests that counted only `handler=...` passed by accident.
- The REPL serves every helper, unminified, since it has no bundler. A build keeps the ones its chunks use.
- `safeUrl$` lost its inline `oxlint-disable-next-line` comment (now file-level), since a comment in a body ends up in the module text.
- The helpers file name starts with `_` (the bundler's name for a `\0` id). `e2e/fixture/chunk.ts` maps it to `helpers`.

## Proposed learnings

- Chunks import runtime helpers from the virtual `idlip/helpers`, and the loader loads its URL with the first chunks | copies repeated in every chunk (dashboard dist -31%), and an import found late costs a round trip | packages/idlip/src/vite, packages/idlip/src/client | yes (`vite.test.ts` helper count, e2e one-round-trip test)
- Import a view chunk by name, not as a namespace | the namespace is an export the entry lacks, so the bundler emits the view twice | packages/idlip/src/compiler/view/codegen | yes (`components.test.ts`)
- Do not add a package entry for code shared with the loader | tsdown splits shared code into files, and the app bundler then splits the loader | packages/idlip | no

## Verification

- `pnpm --filter idlip build && pnpm --filter idlip test`: 67 files, 774 passed, 19 skipped (the differential test included). `tsc --noEmit` in `packages/idlip`: clean.
- `pnpm --filter website build` (28 pages), `pnpm --filter website test` (109 passed), `pnpm --filter website check:samples` (49 samples, 42 live, 0 problems). Website `tsc --noEmit`: clean.
- e2e after `pnpm -r --filter "./examples/*" build`: `E2E_PORT=48651 E2E_COUNTERS_PORT=48652 E2E_SUBS_PORT=48653 E2E_HOT_PORT=48654 pnpm -C e2e test`, 23 passed (loader budget, the new one-round-trip test, the REPL and live-sample tests included).
- Benchmark apps: `build`, `build:rows`, `build:dashboard`, `build:scale` exit 0. `pnpm -C benchmarks/harness test`: 13 passed.
- `rtk proxy pnpm lint`: 0 errors. `pnpm exec oxfmt --check .`: clean.
- Mutation checks: the one-round-trip e2e test fails with the loader preload removed. The components build test fails with the namespace view import.

## Size

- Estimated M, actual M.
