# Outcome: perf-from-bench

## Result

One full run of every scenario for every column on 2026-11-23, at `batch/core` `ed831e4`, Apple M2 (8 cores, 8 GB), Node 26.12.1, Chrome 158. `benchmarks/README.md` holds every table, the load per scenario, the "Where idlip loses" list with design costs marked, a table of each perf node's claim against the run, and the regressions.

| Scenario                   | Command                                                        | 1-minute load, start / end                                     |
| -------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| Todos                      | `pnpm -C benchmarks/harness bench --scenario todos --no-build` | 2.76 / 1.87                                                    |
| Rows                       | `... --scenario rows --no-build`                               | 1.87 / 2.64                                                    |
| Dashboard                  | `... --scenario dashboard --no-build`                          | 2.64 / 3.18                                                    |
| First click A/B, todos     | `first-click-ab.mjs --scenario todos --runs 21`                | 2.72 / 4.06                                                    |
| First click A/B, dashboard | `first-click-ab.mjs --scenario dashboard --runs 21`            | 2.80 / 3.17                                                    |
| Scale (2 runs)             | `node benchmarks/harness/scale.mjs run`                        | 2.66 / 5.87, then 2.53 / 5.28 (builds inside the run raise it) |

Each scenario started under a 1-minute load of 3. The idlip todos, rows and dashboard pages render preload links by default, so their main numbers are with links. The dashboard has a session without links, and the A/B gives both for the first click.

## Headline numbers

| Metric                                       | idlip           | brumate 0.8.1    | Marko 6         |
| -------------------------------------------- | --------------- | ---------------- | --------------- |
| Todos: JS before `load`, gzip                | 5.4 kB (links)  | 15.1 kB          | 4.4 kB          |
| Todos: first click after idle, 150 ms RTT    | 61 ms (links)   | 80 ms            | 77 ms           |
| Todos: SSR renders/s, 3 todos                | 135,135         | 113,233          | 141,196         |
| Rows: create 1,000 rows                      | 27.9 ms         | 32.7 ms          | 32.4 ms         |
| Rows: append 1,000 to 1,000                  | 42.3 ms         | 32.2 ms          | 30.1 ms         |
| Rows: select a row                           | 1.9 ms          | 1.5 ms           | 1.1 ms          |
| Dashboard: JS before `load`, gzip            | 10.2 kB (links) | 23.3 kB          | 10.5 kB         |
| Dashboard: SSR renders/s                     | 4,996           | 4,706            | 6,057           |
| Scale: JS before `load`, 10 to 1,000 widgets | 4.8 kB flat     | 15.9 to 201.5 kB | 5.9 to 117.8 kB |
| Scale: script time to `load`, 4x CPU         | 2.3 to 3.2 ms   | 5.2 to 17.6 ms   | 8.2 to 124.1 ms |

First click after idle at 150 ms latency, off against links: todos 236 to 69 ms, dashboard 250 to 74 ms (real, 3x MAD noise 15 ms).

## Perf gains shown

- `cloned-templates`: yes. Rows create 10,000 380.8 to 247.3 ms, append 62.0 to 42.3 ms, create 1,000 35.4 to 27.9 ms. Ratio to Marko for append 2.22x to 1.41x.
- `shared-helpers`: yes. Dashboard dist 104.2 kB gzip against 146.9 kB before the node. Later widget chunks 700 B against 953 B.
- `perf-ssr-state`: yes. Dashboard SSR 953 to 4,996 renders/s, todos 36,047 to 135,135.
- `preimport-chunks` (links): yes. Same size of gain as its own run.
- `perf-list-kept`: yes. Select 4.3 to 1.9 ms, remove 11.4 to 8.3 ms.
- `text-anchor`: yes. 16 B less per todo (178 to 162 B), rows page 353.0 to 328.2 kB.
- `cloned-templates-all`: no speed claim, consistent (toggle 48 ms). `fix-for-prop-each`: no speed claim.

## Where idlip loses (this run)

Design costs: JS before `load` with links on todos (+23% gzip against Marko), the first-event clicks (todos toggle 2.1x, add 2.0x, counter 1.25x; rows first select, update, remove from the server page 1.3x to 2.2x; dashboard widgets below the fold 1.5x to 2.6x), the SSR HTML (todos 3.3x to 5.9x raw at 0 and 3 todos, +26% to +31% at 100; rows +22% raw against Marko; dashboard 2.8x and 3.4x raw), and the first click without links (one round trip).

Code costs: rows select 1.27x and 1.7x, swap 1.31x, append 1.31x and 1.41x, clear 1.32x against Marko; client JS in dist (todos +57% gzip, rows +64% gzip, dashboard 2.6x and 9.9x gzip); total todos JS +45% gzip; dashboard SSR rate 1.21x behind Marko.

No longer losses: todos SSR rate at 3 todos, the first click with links, rows create, replace, create 10,000, update and remove, dashboard SSR rate against brumate.

## Regressions against the previous README

- JS before `load` grew on todos (3.8 to 5.4 kB gzip) and the dashboard (4.6 to 10.2 kB gzip). This is the preload links, by choice.
- SSR HTML at 0 and 3 todos +0.4 kB raw (the 5 preload links).
- Rows client JS in dist 7.1 to 7.4 kB gzip.
- Dashboard click to update widget 30 47 to 62 ms and widget 1 69 to 84 ms. Single sessions, not confirmed beyond noise.
- Scale: idlip JS on load 4.7 to 4.8 kB gzip (the loader).

## Website

- `website/src/benchmarks.json`: date 2026-11-23, every group from this run. Scale idlip 4.8 kB, script times from the second scale run. The todos, dashboard and first-click metrics now say "idlip with preload links" in their names.
- Landing chart: the lead is computed from the data and now reads "From 10 widgets to 1,000 widgets, idlip loads 4.8 kB before the page is ready." The fallback and the foot still match. `website/test/landing.test.ts` pinned 4.7 kB and now pins 4.8 kB.
- `website/public/og.png`: rebuilt with 4.8 kB (the only number that changed), from `nodes/perf-from-bench/og.html`. Its headline is the old hero, not the current landing hero ("Only the code you click loads."). Not changed here.
- `website/docs/resuming.md`: loader row 10001 B / 3986 B was stale, now 9779 B / 3936 B from the demo build. Document gzip 2089 to 2090 B and binding gzip 236 to 235 B.

## Deviations

- Files outside the owned path: `website/src/benchmarks.json`, `website/test/landing.test.ts`, `website/public/og.png`, `website/docs/resuming.md` (the brief's 2026-11-23 update asks for them).
- Read `nodes/website-landing/log.md` to learn how the share image was made.
- The scale runs started under load 3 but rose above it during the run, because `scale.mjs` builds 16 apps inside the run.

## Not done

- brumate 0.8.1 todos grew from 33.3 to 35.6 kB before `load` with the same version and source. Not looked into, since it is not idlip code.
- No second `ssr-speed` run with 11 rounds. The 5-round spreads are narrow in this run (within 4% for idlip).

## Verification

- `pnpm -C benchmarks/harness test`: 16 passed.
- `pnpm --filter website build` (28 pages) and `pnpm --filter website test` (135 passed).
- `rtk proxy pnpm lint`: exit 0 (existing warnings). `pnpm exec oxfmt --check .`: clean.
- Every benchmark app build exits 0. No processes left running.
