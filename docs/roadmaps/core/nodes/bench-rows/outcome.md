# Outcome: bench-rows

## Built

- Harness (`benchmarks/harness`): the `rows` and `dashboard` scenarios, ported from brumate's harness. New files: `client.mjs` (rows operations, traces, `OPERATIONS`, `RESUMED`, `measureRows`), `rows.mjs` and `rows.d.mts` (row data), `dashboard.mjs` (50 seeded widgets, writers for brumate, marko, qwik and a new `idlip` writer), `profile-rows.mjs` (CPU profile of one rows operation), `scenarios.test.mjs`. Changed: `run.mjs` (`--runs`, `--cpu`, per-scenario builds), `browser.mjs` (dashboard sessions and waterfall), `report.mjs` (rows and dashboard tables), `worker.mjs` and `serve.mjs` (scenario checks and query), `frameworks.mjs` (`SCENARIOS`, `loadApp(name, scenario)`, `hasScenario`).
- `hasScenario(name, scenario)`: an app takes part in rows or dashboard only when its `package.json` has `build:rows` or `build:dashboard`. Qwik 1, Qwik 2 and brumate 0.3.0 stay todos-only and drop out of those tables.
- idlip apps: `benchmarks/idlip/rows/` (`src/app.idlip.tsx` with `<For each={rows} key="id">`, `src/loader.ts`, `src/entry-server.ts`, `vite.config.ts`) and `benchmarks/idlip/dashboard/` (`src/entry-server.ts`, `vite.config.ts`; `build:dashboard` writes `src/widgets/*.idlip.tsx`). `adapter.js` has `loadRows()` and `loadDashboard()`.
- brumate 0.8.1 and Marko 6: `rows/` and `dashboard/` copied from brumate's repo, with `build:rows`, `build:dashboard`, `loadRows()`, `loadDashboard()`.
- `benchmarks/README.md`: both tables from one run, the scenarios, metrics, options and an extended "Where idlip loses" list. `benchmarks/.gitignore` ignores the generated widgets.
- The dashboard was not split out. Both scenarios are built and measured here.

Every rows operation is expressible in idlip, swap included. No cell is empty.

### Run

`pnpm -C benchmarks/harness bench --scenario rows,dashboard --only idlip,brumate,marko` (10 runs, 5 SSR rounds) on `batch/core` 087996d plus the bench-rows apps and harness (squashed into this node's commit; the dashboard click check was tightened after the run), 2026-11-21, Apple M2, 8 cores, 8 GB, Node 26.12.1, Chrome 158. The load average from the harness (`os.loadavg()` in the result file) was 11.09 9.05 7.53 at the start and 3.91 5.49 6.46 at the end. 887 s. A second `--metrics ssr-speed --rounds 11 --no-build` run (load 4.33 at the start, 9.51 at the end) is in brackets. Timing claims below need a gap over 20% and a min-max range that does not overlap; every rows loss meets both.

#### Rows table

Main thread from click to paint, ms, median of 10 (min-max).

| Metric                                       | idlip                      | brumate 0.8.1        | Marko 6             |
| -------------------------------------------- | -------------------------- | -------------------- | ------------------- |
| Create 1,000 rows                            | 35.4 (33.9-41.8)           | 22.1 (20.5-24.2)     | 21.0 (20.1-22.7)    |
| Replace 1,000 rows                           | 42.9 (40.2-48.7)           | 27.5 (25.5-28.5)     | 24.1 (23.3-25.5)    |
| Update every 10th of 1,000 rows              | 13.5 (12.7-15.1)           | 10.5 (9.8-11.4)      | 9.0 (8.2-10.0)      |
| Select a row of 1,000                        | 4.3 (3.8-4.6)              | 1.6 (1.4-1.9)        | 1.2 (0.9-1.4)       |
| Swap 2 of 1,000 rows                         | 9.7 (9.0-10.8)             | 5.6 (4.6-6.8)        | 4.4 (3.8-4.8)       |
| Remove a row of 1,000                        | 11.4 (10.8-13.2)           | 7.2 (5.7-8.4)        | 6.4 (5.7-7.5)       |
| Create 10,000 rows                           | 380.8 (361.4-404.5)        | 257.8 (249.1-266.2)  | 237.7 (231.7-254.4) |
| Append 1,000 rows to 1,000                   | 62.0 (50.1-66.3)           | 31.0 (30.1-35.6)     | 27.9 (27.0-31.6)    |
| Clear 1,000 rows                             | 5.1 (4.3-5.4)              | 3.4 (3.2-3.5)        | 2.5 (2.2-2.8)       |
| JS heap after creating 1,000 rows            | 2.4 MB                     | 2.6 MB               | 2.6 MB              |
| Server page, 1,000 rows: main thread busy    | 55.2 (49.5-61.1)           | 55.9 (51.1-61.3)     | 57.4 (52.4-89.3)    |
| Server page: longest task                    | 21.8 (21.0-23.4)           | 24.8 (23.0-27.9)     | 27.6 (23.7-43.5)    |
| Server page: JS heap                         | 0.8 MB                     | 1.4 MB               | 1.3 MB              |
| First select, main thread / to paint         | 13.6 / 31.0                | 7.2 / 14.2           | 6.8 / 13.2          |
| First update every 10th, main thread / paint | 30.5 / 39.5                | 25.6 / 28.3          | 28.4 / 31.8         |
| First remove, main thread / to paint         | 38.3 / 45.8                | 24.9 / 28.6          | 24.8 / 29.1         |
| Client JS emitted in dist                    | 15 files, 14.8 kB / 7.1 kB | 7, 85.1 kB / 29.9 kB | 1, 9.3 kB / 4.5 kB  |
| SSR HTML, 1,000 rows                         | 353.0 kB / 23.5 kB         | 307.2 kB / 24.3 kB   | 269.4 kB / 31.8 kB  |
| SSR renders/s, 1,000 rows [11 rounds]        | 553 (473-677) [979]        | 693 (627-716) [946]  | 432 (366-469) [725] |

#### Dashboard table

| Metric                                         | idlip                    | brumate 0.8.1               | Marko 6                     |
| ---------------------------------------------- | ------------------------ | --------------------------- | --------------------------- |
| JS before `load`                               | 1 file, 12.2 kB / 4.6 kB | 4, 110.6 kB / 23.3 kB       | 1, 66.7 kB / 10.5 kB        |
| JS fetched while idle 3 s                      | 0                        | 0                           | 0                           |
| First click, widget 1: requests, JS            | 3, 1.5 kB / 983 B        | 0                           | 0                           |
| First click, widget 30: JS on scroll, on click | 0; 3, 1.5 kB / 953 B     | 0                           | 0                           |
| Widget 30 after widget 1                       | 3, 1.5 kB / 953 B        | 0                           | 0                           |
| Widget 45 Mode after both                      | 3, 1.1 kB / 785 B        | 0                           | 0                           |
| Total JS after 3 widgets                       | 10, 16.2 kB / 7.3 kB     | 4, 110.6 kB / 23.3 kB       | 1, 66.7 kB / 10.5 kB        |
| Click to update (widget 1 / 30 / 45)           | 69 / 47 / 48 ms          | 53 / 18 / 18 ms             | 48 / 19 / 19 ms             |
| Client JS emitted in dist                      | 364, 197.4 kB / 123.0 kB | 7, 162.8 kB / 39.5 kB       | 1, 66.7 kB / 10.5 kB        |
| SSR HTML                                       | 108.8 kB / 9.1 kB        | 33.6 kB / 6.0 kB            | 27.5 kB / 5.4 kB            |
| SSR renders/s [11 rounds]                      | 953 (847-1,004) [1,382]  | 2,367 (2,225-3,103) [4,588] | 3,976 (3,412-4,057) [6,359] |
| First click widget 1 after idle, 150 ms RTT    | 219 ms, 1 RT, 3 req      | 56 ms, 0 RT                 | 47 ms, 0 RT                 |
| First click widget 1 cold, 150 ms RTT          | 216 ms, 1 RT, 3 req      | 480 ms, 0 RT                | 50 ms, 0 RT                 |

No app here has an idle preload, so the "preload off" session is n/a for all three.

#### Where idlip loses (rows and dashboard)

Ratios are idlip over brumate 0.8.1 and over Marko 6. "Likely cost" names where in `packages/idlip` the time or bytes go. Profiled: create and append (Chrome CPU profile with `profile-rows.mjs` on an unminified build, 5 rounds), dashboard and rows SSR (Node inspector profile over 500 and 100 renders), and the state script split of both pages (measured from the HTML). The rest are guesses from reading the code.

| Metric                                                 | idlip                          | Behind                                  | Gap                                             | Likely cost                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------ | ------------------------------ | --------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Create 1,000 rows                                      | 35.4 ms                        | 22.1, 21.0                              | 1.6x, 1.7x                                      | Profiled. `patchList` (`src/client/list/index.ts`) parses each new row alone through `parseHtml` (`src/client/patch/dom.ts`): one `<template>` and one `innerHTML` per row, then `before(...nodes)` and `findInnerBlocks` / `collectBlocks` (`src/client/patch/blocks.ts`) per row. Of 16.5 ms script time a round, `parseHtml` takes 8.1 ms, `collectBlocks` 1.0, `isComment` 0.5. One parse for all new rows would cut most of it. |
| Replace 1,000 rows                                     | 42.9 ms                        | 27.5, 24.1                              | 1.6x, 1.8x                                      | Create as above, plus `removeRange` of 1,000 old rows and their remove hooks (guess).                                                                                                                                                                                                                                                                                                                                                |
| Create 10,000 rows                                     | 380.8 ms                       | 257.8, 237.7                            | 1.5x, 1.6x                                      | Same as create (guess: same path, 10x the rows).                                                                                                                                                                                                                                                                                                                                                                                     |
| Append 1,000 rows to 1,000                             | 62.0 ms                        | 31.0, 27.9                              | 2.0x, 2.2x                                      | Profiled. Create cost for the new rows (`parseHtml` 6.9 ms), plus a pass over the 1,000 kept rows: `walk` 1.1, `findNodes` 0.9, `patchRow` 0.6, `readRows` 0.5, `checkKeyed` 0.4 ms (`src/client/list/index.ts`, `src/client/patch/diff.ts`). The comment in `patchList` says "A chosen row binding runs on every kept row".                                                                                                         |
| Select a row                                           | 4.3 ms                         | 1.6, 1.2                                | 2.7x, 3.6x                                      | Guess. The row class reads `selected`, so the compiler makes one binding `rows._.id_selected`; a change of `selected` runs it on all 1,000 rows (the kept-row pass in `patchList`, or the binding dispatch in `src/client`) instead of the 2 rows whose class changes.                                                                                                                                                               |
| Swap 2 rows                                            | 9.7 ms                         | 5.6, 4.4                                | 1.7x, 2.2x                                      | Guess. `readRows` walks every row marker, then the kept-row binding pass runs on 1,000 rows, as in append.                                                                                                                                                                                                                                                                                                                           |
| Remove a row                                           | 11.4 ms                        | 7.2, 6.4                                | 1.6x, 1.8x                                      | Guess. Same kept-row pass as swap.                                                                                                                                                                                                                                                                                                                                                                                                   |
| Update every 10th                                      | 13.5 ms                        | 10.5, 9.0                               | 1.3x, 1.5x                                      | Guess. `checkKeyed` diff and `patchRow` on all 1,000 rows, not only the 100 changed labels.                                                                                                                                                                                                                                                                                                                                          |
| Clear 1,000 rows                                       | 5.1 ms                         | 3.4, 2.5                                | 1.5x, 2.0x                                      | Guess. `removeRange` per row and `removeBlock` hooks (`src/client/patch/blocks.ts`) per row, where the others clear the parent at once.                                                                                                                                                                                                                                                                                              |
| First select from the server page                      | 13.6 / 31.0 ms                 | 7.2 / 14.2, 6.8 / 13.2                  | 1.9x, 2.0x main thread; 2.2x, 2.3x to paint     | Guess. The click fetches the handler and binding chunks, reads the state script (seroval) and the server markers on the first event, then runs the select pass above.                                                                                                                                                                                                                                                                |
| First update every 10th from the server page, to paint | 39.5 ms                        | 28.3, 31.8                              | 1.4x, 1.24x (main thread 30.5 ms is within 20%) | Guess. The chunk fetch on the click.                                                                                                                                                                                                                                                                                                                                                                                                 |
| First remove from the server page                      | 38.3 / 45.8 ms                 | 24.9 / 28.6, 24.8 / 29.1                | 1.5x main thread, 1.6x to paint                 | Guess. Chunk fetch, state read, then the remove pass.                                                                                                                                                                                                                                                                                                                                                                                |
| Rows client JS in dist                                 | 14.8 kB / 7.1 kB               | Marko 9.3 kB / 4.5 kB                   | +59% raw, +58% gzip                             | Measured. The loader is 9.9 kB / 4.0 kB on its own (`src/client`), and the rows page adds 14 small chunks.                                                                                                                                                                                                                                                                                                                           |
| Rows SSR HTML, raw                                     | 353.0 kB                       | Marko 269.4 kB (brumate 307.2 kB, +15%) | +31%                                            | Measured. 38 kB is the state script with the 1,000-row model (`src/server/render.ts`). The rest is markers per row: `<!--i-->`, `<!--t2-->...<!--/t-->`, `i-a` attributes and the `on:click` JSON on two links (server codegen in `src/compiler`). In gzip idlip is the smallest (23.5 kB).                                                                                                                                          |
| Dashboard first click: requests                        | 3                              | 0, 0                                    |                                                 | By design: handler, binding and list chunks load on the click.                                                                                                                                                                                                                                                                                                                                                                       |
| Dashboard click to update, widgets 30 and 45           | 47, 48 ms                      | 18, 18 and 19, 19                       | 2.6x, 2.5x                                      | Measured as requests: the 3-chunk fetch is inside the click.                                                                                                                                                                                                                                                                                                                                                                         |
| Dashboard click to update, widget 1                    | 69 ms                          | 53, 48                                  | 1.3x, 1.4x                                      | Same, plus the first state read.                                                                                                                                                                                                                                                                                                                                                                                                     |
| Dashboard first click after idle, 150 ms RTT           | 219 ms                         | 56, 47                                  | 3.9x, 4.7x                                      | One round trip for 3 chunks.                                                                                                                                                                                                                                                                                                                                                                                                         |
| Dashboard first click cold, 150 ms RTT                 | 216 ms                         | Marko 50 (brumate 480 is behind idlip)  | 4.3x against Marko                              | Same.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Dashboard client JS in dist                            | 364 files, 197.4 kB / 123.0 kB | 162.8 / 39.5, 66.7 / 10.5               | +21% raw and 3.1x gzip; 3.0x raw and 11.7x gzip | Measured. About 7 chunks per widget (run, cycle, 3 bindings, list, view) from the compiler's chunk split; each small file gzips alone and the module-level `summarize` and `listEntries` helpers are copied into each chunk that uses them.                                                                                                                                                                                          |
| Dashboard SSR HTML                                     | 108.8 kB / 9.1 kB              | 33.6 / 6.0, 27.5 / 5.4                  | 3.2x, 4.0x raw; +52%, +69% gzip                 | Measured. Markup is 35.7 kB, close to the others. The state script is 75.8 kB: the chunk URL map 37.5 kB (every chunk of every child module, keyed by its full module id such as `/src/widgets/Widget00.idlip.tsx?idlip-handler=run&lang.js`), the child manifests (`modules`) 32.5 kB, `slots` 5.5 kB. `mergeState` and `collectModules` in `src/server/render.ts` put them all in.                                                 |
| Dashboard SSR renders/s                                | 953 [1,382]                    | 2,367 [4,588], 3,976 [6,359]            | 2.5x, 4.2x [3.3x, 4.6x]                         | Profiled (Node, 500 renders, 1.04 ms a render). `mergeState` 14% self time (object spreads of the chunk maps), seroval parse and serialize of that state about 50% (`parsePlainObject` 11%, `createIndexForValue` 11%, `parseProperties` 7%, `serializeProperties` 7%, `serializeString` 6%). A smaller state script would cut both.                                                                                                 |

Not losses: JS heap (idlip is the smallest), main thread and longest task while the server page loads, rows SSR rate (20% behind brumate at 5 rounds, ahead at 11 rounds, ahead of Marko in both; the rows SSR profile shows `escapeText$` 16% and `on$` 16%, no outlier), rows SSR HTML in gzip, JS before `load` and total JS after 3 widgets in the dashboard (idlip loads the least).

## Proof

- base: `batch/core` 087996d. `pnpm -C benchmarks/harness bench --scenario rows ...` cannot run: the harness has `SCENARIOS = ['todos']` and no rows or dashboard apps, so `run.mjs` rejects `--scenario rows` as unknown.
- branch: `pnpm -C benchmarks/harness bench --scenario rows --only idlip,brumate,marko --rounds 1` prints the rows table with no failed checks and no page errors (98 s, `--runs 1`). The recorded run above prints both tables with no notes besides the busy machine.

## Deviations

- The idlip rows page uses its own loader entry, `rows/src/loader.ts`, which imports `idlip/client` and re-exports the operations of `harness/rows.mjs`, with the plugin's `client` option. Without it the build fails: "a click would load a shared chunk", since 5 handler chunks import `rows.mjs`. The operations (0.9 kB) load at start, as in brumate and Marko.
- The idlip dashboard widgets differ in two places, forced by the view grammar: `<For>` keys by a field, so the list renders from a derived `{ index, value }[]`; and `Math.max(...items)` in a `const` fails with `hole-spread`, so the summary is a module-level helper `summarize(items)`. The handler code is the same generated code as the other apps.
- The idlip dashboard adapter reports `preloadOption: false`: idlip fetches nothing while idle.
- `pnpm-lock.yaml` is unchanged: no new dependencies.
- Generated idlip widgets carry `// @ts-nocheck` and `// oxlint-disable`: the generated handler code has untyped arrow parameters, as in the brumate widgets.

## Stubs left

- None.

## Gotchas

- `pnpm -C benchmarks/harness test` needs `pnpm --filter idlip build`, `pnpm -C benchmarks/idlip build`, `build:rows` and `build:dashboard` first: the tests load the built server entries.
- `profile-rows.mjs` needs an unminified build (`npx vite build rows --minify false` in `benchmarks/idlip`) to name functions. Rebuild normally before a recorded run.
- The machine was very busy (load 11 at the start). The rows timings have tight ranges and gaps of 1.3x to 3.6x, so they hold. The dashboard click times include a chunk fetch and moved by up to 2x between the quick run and the recorded run (Marko widget 1: 192 ms, then 48 ms). Rerun before claiming a change under 20%.
- `--scenario` takes a comma-separated list (`rows,dashboard`), from brumate's `list()` parser.

## Proposed learnings

- A module imported by two idlip handlers must be imported by the loader entry, or the build fails | the vite plugin rejects a click that loads a shared chunk | `benchmarks/**`, `examples/**` | yes (the build fails)

## Verification

- `pnpm -C benchmarks/harness bench --scenario rows --only idlip,brumate,marko --rounds 1` (brief verify): pass, no failed checks.
- `pnpm -C benchmarks/harness bench --scenario rows,dashboard --only idlip,brumate,marko`: pass, both tables, 887 s.
- `pnpm -C benchmarks/harness bench --scenario rows,dashboard --only idlip,brumate,marko --metrics ssr-speed --rounds 11 --no-build`: pass.
- `pnpm -C benchmarks/harness test`: 7 pass.
- After review: the dashboard click check also compares `.summary` and every `li` with the Node result (`expected()` in `harness/dashboard.mjs`, `click()` in `harness/browser.mjs`). `pnpm -C benchmarks/harness bench --scenario dashboard --only idlip,brumate,marko --rounds 1`: pass, no failed interactions (load 5.67 to 9.04). The recorded tables predate this check.
- `pnpm --filter idlip test`: 57 files, 659 tests pass.
- `pnpm format:check`: pass.

## Size

- Estimated L, actual M to L. The harness ported almost verbatim; the idlip apps needed two workarounds found at build time.
