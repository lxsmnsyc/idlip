# Outcome: bench-brumate-latest

## Built

- `benchmarks/brumate`: brumate's own todos app (`src/`, `vite.config.ts`, `adapter.js`) with `brumate` pinned to `npm:brumate@0.8.1` (the npm latest, checked with `npm view brumate version`). It builds and the harness measures it. `brumate-0.3` stays as a column. Column label: `brumate 0.8.1`.
- `benchmarks/harness/count.mjs` (`COUNT_SELECTOR = 'ul + p'`, `parseLeft`), used by `browser.mjs` for the toggle check and the `prepare` step. `count.test.mjs` runs with `pnpm -C benchmarks/harness test`.
- `benchmarks/README.md`: a full todos run (all six columns, `f5ec645`, 2026-11-21, M2 8 cores, load 4.92 at the start and 4.13 at the end), the "Where idlip loses" list, the count reader note and the new folder.
- `pnpm-lock.yaml`: the `benchmarks/brumate` importer only (see Deviations).

Headline: idlip loads the least JS up front among the lazy designs (9.7 kB / 3.8 kB before `load`, against 33.3 kB / 13.9 kB for brumate 0.8.1) but needs 2 requests on the first click (220 ms after idle at 150 ms RTT, against 83 ms for brumate 0.8.1 and 44 ms for Marko). Its SSR render rate at 3 todos is about 2.3x below brumate 0.8.1 and Marko, and its SSR HTML is 3 to 4x larger at 0 and 3 todos.

#### Todos table (full run, 5 SSR rounds)

| Metric                                     | idlip                   | brumate 0.8.1           | brumate 0.3.0           | Marko 6                | Qwik 1                | Qwik 2                 |
| ------------------------------------------ | ----------------------- | ----------------------- | ----------------------- | ---------------------- | --------------------- | ---------------------- |
| JS before `load`                           | 1 file, 9.7 kB / 3.8 kB | 5, 33.3 kB / 13.9 kB    | 3, 26.4 kB / 11.2 kB    | 1, 9.1 kB / 4.4 kB     | 3, 53.4 kB / 22.4 kB  | 3, 97.2 kB / 36.4 kB   |
| JS fetched while idle 3 s                  | 0                       | 0                       | 3, 1.8 kB / 1.2 kB      | 0                      | 1, 935 B / 452 B      | 9, 2.4 kB / 1.8 kB     |
| First counter click: requests, JS          | 2, 473 B / 351 B        | 0                       | 0                       | 0                      | 0                     | 0                      |
| First todo toggle: requests, JS            | 2, 997 B / 613 B        | 0                       | 0                       | 0                      | 0                     | 0                      |
| Total JS after counter, toggle, add        | 11, 13.7 kB / 6.4 kB    | 5, 33.3 kB / 13.9 kB    | 6, 28.2 kB / 12.3 kB    | 1, 9.1 kB / 4.4 kB     | 4, 54.4 kB / 22.8 kB  | 12, 99.6 kB / 38.2 kB  |
| Click to update (counter / toggle / add)   | 113 / 56 / 95 ms        | 95 / 36 / 77 ms         | 56 / 32 / 162 ms        | 37 / 8 / 33 ms         | 56 / 41 / 66 ms       | 70 / 49 / 66 ms        |
| Client JS emitted in dist                  | 13, 14.6 kB / 7.0 kB    | 8, 85.5 kB / 30.2 kB    | 8, 74.3 kB / 26.6 kB    | 1, 9.1 kB / 4.4 kB     | 5, 55.0 kB / 23.3 kB  | 15, 100.4 kB / 38.8 kB |
| SSR HTML, 0 todos                          | 4.4 kB / 1.9 kB         | 1.1 kB / 592 B          | 960 B / 541 B           | 812 B / 557 B          | 2.3 kB / 1.1 kB       | 3.0 kB / 1.4 kB        |
| SSR HTML, 3 todos                          | 4.9 kB / 2.0 kB         | 1.6 kB / 723 B          | 1.4 kB / 672 B          | 1.2 kB / 692 B         | 2.9 kB / 1.3 kB       | 3.6 kB / 1.5 kB        |
| SSR HTML, 100 todos                        | 21.8 kB / 3.3 kB        | 16.3 kB / 2.1 kB        | 16.1 kB / 2.1 kB        | 15.7 kB / 2.8 kB       | 21.5 kB / 3.9 kB      | 20.7 kB / 3.3 kB       |
| SSR HTML, per extra todo                   | 178 B / 14 B            | 155 B / 15 B            | 155 B / 15 B            | 153 B / 23 B           | 197 B / 28 B          | 181 B / 19 B           |
| SSR renders/s, 3 todos                     | 36,047 (28,752-47,446)  | 81,464 (59,962-111,400) | 83,307 (69,140-118,650) | 77,944 (25,876-91,091) | 10,757 (8,403-15,278) | 6,184 (5,804-10,279)   |
| SSR renders/s, 100 todos                   | 7,501 (1,991-8,583)     | 9,034 (3,107-9,857)     | 8,805 (2,870-10,587)    | 5,892 (1,325-7,616)    | 1,864 (513-2,251)     | 1,140 (387-1,523)      |
| First counter click after idle, 150 ms RTT | 220 ms, 1 RT, 2 req     | 83 ms, 0 RT             | 101 ms, 0 RT            | 44 ms, 0 RT            | 63 ms, 0 RT           | 68 ms, 0 RT            |
| First counter click cold, 150 ms RTT       | 226 ms, 1 RT, 2 req     | 108 ms, 0 RT            | 177 ms, 1 RT, 3 req     | 50 ms, 0 RT            | 240 ms, 1 RT, 1 req   | 491 ms, 1 RT, 9 req    |

An 11-round rerun of `ssr-speed` for idlip, brumate 0.8.1 and Marko (load 4.41 to 3.49) gave 46,924 / 108,833 / 130,717 renders/s at 3 todos and 9,289 / 11,243 / 8,219 at 100 todos.

#### Where idlip loses

Each row is a metric where idlip is behind brumate 0.8.1 or Marko 6 by more than 20%. `perf-from-bench` works from this list.

| Metric                                                | idlip                               | Behind                                             | Gap                                                                                                                   |
| ----------------------------------------------------- | ----------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| First counter click and first toggle: requests and JS | 2 requests, 473 B and 997 B         | brumate 0.8.1, Marko: 0                            | The page of idlip loads the handler and binding chunks on the first event. The others hold all code before the click. |
| First counter click, 150 ms RTT, after idle           | 220 ms                              | Marko 44 ms, brumate 83 ms                         | 5.0x and 2.7x                                                                                                         |
| First counter click, 150 ms RTT, cold                 | 226 ms                              | Marko 50 ms, brumate 108 ms                        | 4.5x and 2.1x                                                                                                         |
| Click to update, toggle                               | 56 ms                               | Marko 8 ms, brumate 36 ms                          | 7x and 1.6x                                                                                                           |
| Click to update, add                                  | 95 ms                               | Marko 33 ms, brumate 77 ms (inside the noise)      | 2.9x against Marko                                                                                                    |
| Click to update, counter                              | 113 ms                              | Marko 37 ms (brumate 95 ms is inside the noise)    | 3.1x against Marko                                                                                                    |
| Total JS after counter, toggle, add                   | 13.7 kB / 6.4 kB, 11 files          | Marko 9.1 kB / 4.4 kB, 1 file                      | +51% raw, +45% gzip                                                                                                   |
| Client JS emitted in dist                             | 14.6 kB / 7.0 kB                    | Marko 9.1 kB / 4.4 kB                              | +60% raw, +59% gzip                                                                                                   |
| SSR HTML, 0 todos                                     | 4.4 kB / 1.9 kB                     | brumate 1.1 kB / 592 B, Marko 812 B / 557 B        | 4.0x and 5.4x raw                                                                                                     |
| SSR HTML, 3 todos                                     | 4.9 kB / 2.0 kB                     | brumate 1.6 kB / 723 B, Marko 1.2 kB / 692 B       | 3.1x and 4.1x raw                                                                                                     |
| SSR HTML, 100 todos                                   | 21.8 kB / 3.3 kB                    | brumate 16.3 kB / 2.1 kB, Marko 15.7 kB            | +34% raw, +57% gzip against brumate; +39% raw against Marko                                                           |
| SSR renders/s, 3 todos                                | 36,047 (46,924 in the 11-round run) | brumate 81,464, Marko 77,944 (108,833 and 130,717) | 2.3x and 2.2x (2.3x and 2.8x)                                                                                         |

Not losses: JS before `load` (idlip 9.7 kB / 3.8 kB is 6% above Marko in raw bytes and 14% below in gzip, and well below brumate 0.8.1's 33.3 kB), SSR rate at 100 todos (17% behind brumate 0.8.1 in the table and 17% in the 11-round run, inside the noise; ahead of Marko), and the cost of an extra todo (178 B against 155 B and 153 B).

## Proof

- base: `batch/core` (`f5ec645`). Rendering the idlip page for 3 todos and applying the harness regex `/(\d+) left/` to the text with the tags removed gives `32` (expected 2): the last title "Todo number 3" runs into "2 left". Command: `node -e "import('./benchmarks/harness/frameworks.mjs').then(async (m) => console.log(/(\\d+) left/.exec((await (await m.loadApp('idlip')).render(3)).replace(/<[^>]*>/g, ''))[1]))"` (needs `pnpm --filter idlip build` and `pnpm -C benchmarks/idlip build` first); it prints `32`. A full `bench --only idlip` on base still passes the toggle check by accident, because 32 - 1 = 31 matches "Todo number 31 left" after the toggle.
- branch: `pnpm -C benchmarks/harness test` passes 3 tests: the body regex gives `32`, the `ul + p` reader gives `2`, `parseLeft` rejects "Todo number 32 left". The harness reads `ul + p` in the page.

## Deviations

- `pnpm-lock.yaml` changed by 54 lines for the `benchmarks/brumate` importer (brumate 0.8.1 and its dependencies) and the `happy-dom` 21.0.4 dev dependency of the harness, which the count test uses.
- The count check is a node test, not a browser test: it reproduces the reader on the SSR HTML, where "32" appears.
- Brumate's harness has no change that alters todos numbers (diffed `browser.mjs`, `worker.mjs`, `serve.mjs`, `chrome.mjs`, `run.mjs`: the differences are the dashboard and rows scenarios). Nothing ported besides the app.
- The brumate app's `package.json` still says `bench-brumate` as in the source; the package is pinned, not `workspace:*`.

## Stubs left

- None.

## Gotchas

- Brumate 0.8.1 loads everything before `load` and fetches nothing on click, so the idlip first-click rows lose to it by design. The comparison that matters for the lazy design is brumate 0.3.0, which fetches 3 files at idle.
- `pnpm install` prints "Agent skills awaiting approval: brumate"; it does not block the build.
- Timings moved by more than 20% between runs under load (counter click of brumate 0.8.1: 95 ms, 376 ms, 41 ms). Use the 11-round `ssr-speed` rerun for SSR claims.
- `pnpm format:check` fails on `docs/roadmaps/core/contracts/markup-grammar.md`, which this node does not own.

## Proposed learnings

- None.

## Verification

- `pnpm -C benchmarks/harness bench --scenario todos --only idlip,brumate,marko --rounds 1`: pass, no FAILED checks (also after formatting).
- `pnpm -C benchmarks/harness bench --scenario todos`: pass, 181 s.
- `pnpm -C benchmarks/harness test`: 3 pass.
- `pnpm --filter idlip test`: 57 files, 659 tests pass.
- `pnpm format:check`: only the file above, not owned by this node.

## Size

- Estimated M, actual M.
