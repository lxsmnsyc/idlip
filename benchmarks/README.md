# Benchmarks

Three pages, each built by several frameworks: the todos page (idlip, brumate 0.8.1, the latest on npm, brumate 0.3.0, Marko 6, Qwik 1 and Qwik 2), and the rows and dashboard pages (idlip, brumate 0.8.1 and Marko 6). One script builds, serves and measures all of them. The harness and the non-idlip apps come from [brumate's benchmarks](https://github.com/lxsmnsyc/brumate) (MIT, same author).

```bash
pnpm install
pnpm -C benchmarks/harness bench
```

The command prints a markdown table for each scenario and writes `results/<timestamp>.json` and `results/<timestamp>.md`. Git ignores the results. The todos scenario takes about 3 minutes on an Apple M2, and rows and dashboard for three frameworks about 15 minutes with 10 runs. The workspace lists `benchmarks/*`, but the root `build` and `test` scripts filter to `packages/*` and `examples/*`, no app here has a `typecheck` script, and oxlint ignores the folder.

## Results

### Todos

A run of `pnpm -C benchmarks/harness bench --scenario todos` on branch `feat/bench-brumate-latest` at `f5ec645` (the benchmark changes were uncommitted), on 2026-11-21. The machine was an Apple M2 with 8 cores and 8 GB, Node 26.12.1 and Chrome 158. Other agents were building and testing at the same time: the load average was 4.92 4.61 4.64 at the start and 4.13 4.72 4.70 at the end, which is about 0.6 per core. Read timings that differ by less than 20% as equal. Sizes are raw / gzip -9. Renders per second are the median of 5 rounds, with the min and max.

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

The SSR rates spread widely at 5 rounds on a busy machine. A second run of only `ssr-speed` for idlip, brumate 0.8.1 and Marko, with 11 rounds (load average 4.41 at the start, 3.49 at the end), was steadier: 3 todos 46,924 (idlip), 108,833 (brumate 0.8.1), 130,717 (Marko); 100 todos 9,289, 11,243 and 8,219. The ratios match the table.

### Rows and dashboard

A run of `pnpm -C benchmarks/harness bench --scenario rows,dashboard --only idlip,brumate,marko` on `batch/core` 087996d plus the bench-rows apps and harness (squashed into this node's commit; the dashboard click check was tightened after the run), on 2026-11-21. Same machine (Apple M2, 8 cores, 8 GB, Node 26.12.1, Chrome 158). Other agents were working: the load average from the harness (`os.loadavg()` in the result file) was 11.09 9.05 7.53 at the start and 3.91 5.49 6.46 at the end, about 1.4 per core at the start. The rows timings are the median of 10 runs with the min and max; their spread is small next to the gaps below. Sizes are raw / gzip -9. SSR rates are the median of 5 rounds; a second `ssr-speed` run with 11 rounds (load 4.33 at the start, 9.51 at the end) is in brackets.

#### Rows

Main thread from click to paint, in ms.

| Metric                                                             | idlip                      | brumate 0.8.1        | Marko 6             |
| ------------------------------------------------------------------ | -------------------------- | -------------------- | ------------------- |
| Create 1,000 rows                                                  | 35.4 (33.9-41.8)           | 22.1 (20.5-24.2)     | 21.0 (20.1-22.7)    |
| Replace 1,000 rows                                                 | 42.9 (40.2-48.7)           | 27.5 (25.5-28.5)     | 24.1 (23.3-25.5)    |
| Update every 10th of 1,000 rows                                    | 13.5 (12.7-15.1)           | 10.5 (9.8-11.4)      | 9.0 (8.2-10.0)      |
| Select a row of 1,000                                              | 4.3 (3.8-4.6)              | 1.6 (1.4-1.9)        | 1.2 (0.9-1.4)       |
| Swap 2 of 1,000 rows                                               | 9.7 (9.0-10.8)             | 5.6 (4.6-6.8)        | 4.4 (3.8-4.8)       |
| Remove a row of 1,000                                              | 11.4 (10.8-13.2)           | 7.2 (5.7-8.4)        | 6.4 (5.7-7.5)       |
| Create 10,000 rows                                                 | 380.8 (361.4-404.5)        | 257.8 (249.1-266.2)  | 237.7 (231.7-254.4) |
| Append 1,000 rows to 1,000                                         | 62.0 (50.1-66.3)           | 31.0 (30.1-35.6)     | 27.9 (27.0-31.6)    |
| Clear 1,000 rows                                                   | 5.1 (4.3-5.4)              | 3.4 (3.2-3.5)        | 2.5 (2.2-2.8)       |
| JS heap after creating 1,000 rows                                  | 2.4 MB                     | 2.6 MB               | 2.6 MB              |
| Server page, 1,000 rows: main thread busy during load and 3 s idle | 55.2 (49.5-61.1)           | 55.9 (51.1-61.3)     | 57.4 (52.4-89.3)    |
| Server page: longest task                                          | 21.8 (21.0-23.4)           | 24.8 (23.0-27.9)     | 27.6 (23.7-43.5)    |
| Server page: JS heap                                               | 0.8 MB                     | 1.4 MB               | 1.3 MB              |
| First select from the server page, main thread / to paint          | 13.6 / 31.0                | 7.2 / 14.2           | 6.8 / 13.2          |
| First update every 10th from the server page                       | 30.5 / 39.5                | 25.6 / 28.3          | 28.4 / 31.8         |
| First remove from the server page                                  | 38.3 / 45.8                | 24.9 / 28.6          | 24.8 / 29.1         |
| Client JS emitted in dist                                          | 15 files, 14.8 kB / 7.1 kB | 7, 85.1 kB / 29.9 kB | 1, 9.3 kB / 4.5 kB  |
| SSR HTML, 1,000 rows                                               | 353.0 kB / 23.5 kB         | 307.2 kB / 24.3 kB   | 269.4 kB / 31.8 kB  |
| SSR renders/s, 1,000 rows                                          | 553 (473-677) [979]        | 693 (627-716) [946]  | 432 (366-469) [725] |

Every operation runs in idlip, swap included, and passes the page checks. The first clicks from a server page include idlip's chunk fetch.

#### Dashboard

| Metric                                                          | idlip                    | brumate 0.8.1               | Marko 6                     |
| --------------------------------------------------------------- | ------------------------ | --------------------------- | --------------------------- |
| JS before `load`                                                | 1 file, 12.2 kB / 4.6 kB | 4, 110.6 kB / 23.3 kB       | 1, 66.7 kB / 10.5 kB        |
| JS fetched while idle 3 s                                       | 0                        | 0                           | 0                           |
| First click, widget 1: requests, JS                             | 3, 1.5 kB / 983 B        | 0                           | 0                           |
| First click, widget 30 (below the fold): JS on scroll, on click | 0; 3, 1.5 kB / 953 B     | 0                           | 0                           |
| Widget 30 after widget 1 (scroll and click)                     | 3, 1.5 kB / 953 B        | 0                           | 0                           |
| Widget 45 Mode after both (scroll and click)                    | 3, 1.1 kB / 785 B        | 0                           | 0                           |
| Total JS after 3 widgets                                        | 10, 16.2 kB / 7.3 kB     | 4, 110.6 kB / 23.3 kB       | 1, 66.7 kB / 10.5 kB        |
| Click to update (widget 1 / 30 / 45)                            | 69 / 47 / 48 ms          | 53 / 18 / 18 ms             | 48 / 19 / 19 ms             |
| Client JS emitted in dist                                       | 364, 197.4 kB / 123.0 kB | 7, 162.8 kB / 39.5 kB       | 1, 66.7 kB / 10.5 kB        |
| SSR HTML                                                        | 108.8 kB / 9.1 kB        | 33.6 kB / 6.0 kB            | 27.5 kB / 5.4 kB            |
| SSR renders/s                                                   | 953 (847-1,004) [1,382]  | 2,367 (2,225-3,103) [4,588] | 3,976 (3,412-4,057) [6,359] |
| First click on widget 1 after idle, 150 ms RTT                  | 219 ms, 1 RT, 3 req      | 56 ms, 0 RT                 | 47 ms, 0 RT                 |
| First click on widget 1 cold, 150 ms RTT                        | 216 ms, 1 RT, 3 req      | 480 ms, 0 RT                | 50 ms, 0 RT                 |

No framework here has an idle preload to turn off, so the "preload off" session is n/a for all three. idlip loads the least JS before `load` and in total after 3 widgets, and pays 3 requests on each widget's first click.

### Scale

Does startup stay flat as the app grows? One page per size, with N distinct widget components (N = 10, 50, 200 and 1,000), built by idlip, brumate 0.8.1, Marko 6 and Qwik 2. The widgets are the dashboard's (see [Scale scenario](#scale-scenario)). Run on 2026-11-22, Apple M2, Chrome 158. Every page passed its checks: all widgets in the HTML and the DOM, a first click that shows what Node computes, and no page errors.

Bytes are exact and do not depend on load. The timings are from the run with the lowest load of the three runs made (the 1-minute load average before and after each size: 10 widgets 2 before and 2.22 after; 50 widgets 2.22 before and 2.34 after; 200 widgets 2.34 before and 2.84 after; 1,000 widgets 2.84 before and 3.16 after). The two earlier runs, at 1-minute loads of 2.4 to 8.2 and 3.4 to 4.8, agree on script times within about 20% and show the same order. Their task times at 1,000 widgets differ by 30% (idlip 481 and 614 ms), so read the task times as an order of magnitude.

Gzip -9, kB. "Before the first click" is the page load plus a 3 s idle wait. "All bytes" adds up the HTML, the JS and every other fetch (Qwik 2's `bundle-graph.json` and similar).

| Metric                                | App   | idlip | brumate 0.8.1 | Marko 6 |  Qwik 2 |
| ------------------------------------- | ----- | ----: | ------------: | ------: | ------: |
| JS before `load`                      | 10    |   4.7 |          15.9 |     5.9 |    37.3 |
|                                       | 50    |   4.7 |          23.8 |    10.8 |    37.3 |
|                                       | 200   |   4.7 |          52.6 |    28.1 |    37.3 |
|                                       | 1,000 |   4.7 |         201.5 |   117.8 |    37.3 |
| JS before the first click             | 10    |   4.7 |          15.9 |     5.9 |    51.2 |
|                                       | 50    |   4.7 |          23.8 |    10.8 |   106.3 |
|                                       | 200   |   4.7 |          52.6 |    28.1 |   312.0 |
|                                       | 1,000 |   4.7 |         201.5 |   117.8 | 1,409.1 |
| HTML                                  | 10    |   3.4 |           1.8 |     1.7 |     4.3 |
|                                       | 50    |   8.5 |           6.2 |     5.6 |    16.5 |
|                                       | 200   |  25.9 |          22.3 |    19.0 |    63.5 |
|                                       | 1,000 | 112.0 |         103.9 |    87.9 |   302.6 |
| Non-JS fetches before the first click | 10    |   0.0 |           0.0 |     0.0 |     1.0 |
|                                       | 50    |   0.0 |           0.0 |     0.0 |     4.7 |
|                                       | 200   |   0.0 |           0.0 |     0.0 |    18.5 |
|                                       | 1,000 |   0.0 |           0.0 |     0.0 |    92.2 |
| All bytes before `load`               | 10    |   8.1 |          17.8 |     7.6 |    42.7 |
|                                       | 50    |  13.2 |          30.0 |    16.3 |    58.5 |
|                                       | 200   |  30.6 |          74.9 |    47.1 |   119.3 |
|                                       | 1,000 | 116.7 |         305.3 |   205.8 |   432.1 |
| All bytes before the first click      | 10    |   8.1 |          17.8 |     7.6 |    56.6 |
|                                       | 50    |  13.2 |          30.0 |    16.3 |   127.5 |
|                                       | 200   |  30.6 |          74.9 |    47.1 |   394.0 |
|                                       | 1,000 | 116.7 |         305.3 |   205.8 | 1,803.9 |

Raw sizes, kB. idlip's JS is 12.5 kB at every size. Its HTML is 21.8, 101.0, 400.3, 2,001.2 kB, against 5.9, 28.2, 113.7, 579.5 kB for Marko 6. brumate's HTML is 7.3 to 696.9 kB and Qwik 2's 14.8 to 1,382.7 kB. Raw JS at 1,000 widgets: brumate 1,699.1 kB, Marko 1,226.9 kB, Qwik 2 99.4 kB before `load` and 2,179.1 kB before the first click.

Main-thread time from navigation to `load`, 4x CPU slowdown, median of 10 loads, ms:

| Metric      | App   | idlip | brumate 0.8.1 | Marko 6 | Qwik 2 |
| ----------- | ----- | ----: | ------------: | ------: | -----: |
| Script time | 10    |   2.7 |           5.0 |     7.4 |    2.6 |
|             | 50    |   2.5 |           6.6 |    15.3 |    2.6 |
|             | 200   |   3.1 |           9.1 |    34.8 |    3.2 |
|             | 1,000 |   2.7 |          17.6 |   124.5 |    5.1 |
| Task time   | 10    |    52 |            54 |      55 |     53 |
|             | 50    |    68 |            69 |      77 |     68 |
|             | 200   |   129 |           123 |     150 |    119 |
|             | 1,000 |   451 |           424 |     507 |    387 |

Script time is what the page runs as JavaScript (CDP `ScriptDuration`). Task time is all main-thread work (`TaskDuration`), which includes parsing the HTML and laying out N widgets of 480 px each, so it grows for every framework and is mostly the page, not the framework.

What the numbers say:

- **JS on load is flat for idlip**: 4.7 kB gzip from 10 to 1,000 widgets, one file. The first click fetches about 1 kB more. brumate grows 12.7x and Marko 20x from 10 to 1,000 widgets. Qwik 2 is flat too, at 37.3 kB.
- **Qwik 2 keeps loading while idle.** Its JS before the first click grows with the app (51.2 kB to 1,409.1 kB, 44 to 4,004 files), because it preloads the code of every widget. That is background work, not part of `load`, so the "before `load`" rows are the fairer view of its startup. The landing chart uses them.
- **Total bytes are not flat for idlip.** All bytes before the first click go from 8.1 to 116.7 kB, 14x. The HTML is the cost: idlip writes each widget's state and listeners into the page, 2.0 MB raw at 1,000 widgets, 3.5x Marko 6's HTML. It still has the fewest bytes from 50 widgets up (16.3 kB for Marko 6 at 50 widgets and 205.8 kB at 1,000). At 10 widgets Marko 6 is smaller (7.6 kB against 8.1 kB).
- **Script time is flat for idlip** (2.5 to 3.1 ms) and for Qwik 2 (2.6 to 5.1 ms). Marko 6 grows 17x, brumate 4x.
- **Task time does not separate the frameworks.** All four are within about 30% of each other at every size (52 to 451 ms for idlip, 53 to 387 ms for Qwik 2), and the run-to-run spread is as large.

The widgets are made from 17 handler steps and 12 formatters with random constants, so 1,000 of them repeat much code. That helps every bundler's gzip and Marko most, which ships one file. A real app of 1,000 components would compress less.

### Where idlip loses

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

Rows and dashboard (the run above). Ratios are idlip over brumate 0.8.1 and over Marko 6. "Likely cost" names where in `packages/idlip` the time or bytes go. Profiled: create and append (Chrome CPU profile with `profile-rows.mjs` on an unminified build, 5 rounds), dashboard and rows SSR (Node inspector profile over 500 and 100 renders), and the state script split of both pages (measured from the HTML). The rest are guesses from reading the code.

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

Not losses in rows and dashboard: the JS heap (idlip is the smallest), the main thread while the server page loads, SSR rate at 1,000 rows (20% behind brumate at 5 rounds, ahead at 11 rounds, ahead of Marko in both), SSR HTML of 1,000 rows in gzip, JS before `load` and total JS after 3 widgets (idlip loads the least).

Not losses in todos: JS before `load` (idlip 9.7 kB / 3.8 kB is 6% above Marko in raw bytes and 14% below in gzip, and well below brumate 0.8.1's 33.3 kB), SSR rate at 100 todos (17% behind brumate 0.8.1 in the table and 17% in the 11-round run, inside the noise; ahead of Marko), and the cost of an extra todo (178 B against 155 B and 153 B).

Reading the table:

- Brumate 0.8.1 loads 33.3 kB before `load` (up from 26.4 kB in 0.3.0) and then needs no request for any click. Brumate 0.3.0 and Qwik fetch some code while idle. idlip fetches nothing while idle, which is the design in the GOAL, and pays on the first click: 2 requests.
- The SSR HTML of idlip is larger because it carries the serialized state and the loader listener. The cost per extra todo is close to the others.
- Marko ships the page as one 9.1 kB file and needs no request, so it wins the click, the render rate at 3 todos and the emitted size.
- The click-to-update times include the chunk fetch for idlip's first click of each kind, so they are not an update cost alone. They vary by 20% or more between runs (an earlier run with load 3.9 gave idlip 87 / 72 / 99 ms and brumate 0.8.1 376 / 47 / 116 ms, where brumate's counter click took 376 ms).

## Scenarios

`--scenario todos`, `--scenario rows`, `--scenario dashboard` or a comma-separated list runs those. The default runs all three. An app takes part in rows or dashboard only when its `package.json` has a `build:rows` or `build:dashboard` script, so the Qwik and brumate 0.3.0 columns stay todos-only.

### Todos

Every app renders the same page:

- A todo list with an input and an Add button. Each item is a button that toggles it done. The list is keyed by ID. Updates make new arrays and objects.
- A `N left` line computed from the list.
- A counter that shows `Clicked N times` and `Double: 2N`.

The server seeds `N` todos, where item `i` is done when `i % 3 === 0`. The page server reads `N` from the `?n=` query parameter, or from the `BENCH_TODOS` environment variable, and defaults to 3. The SSR metrics render 0, 3 and 100 todos.

### Rows

The table of [js-framework-benchmark](https://krausest.github.io/js-framework-benchmark/current.html), without its stylesheet:

- Buttons with the IDs `run` (create 1,000 rows), `runlots` (create 10,000 rows), `add` (append 1,000 rows), `update` (add ` !!!` to every 10th label), `clear` and `swaprows` (swap the second and the 999th row).
- A `tbody` with a `tr` for each row, keyed by ID. A row has its ID, a link that selects it, and a link that removes it. The selected row has the class `danger`.

[`harness/rows.mjs`](./harness/rows.mjs) makes the rows and the new lists, and every app imports it, so the apps differ only in how they render and update. The page server reads the number of rows from `?n=`, and defaults to 0.

The idlip page is `idlip/rows/src/app.idlip.tsx`, with `<For each={rows} key="id">`. Every operation is expressible, swap included. Its handlers call the list operations of `rows.mjs`, and the idlip Vite plugin rejects a handler chunk that imports a chunk the loader does not import, so the loader is `idlip/rows/src/loader.ts`: it imports `idlip/client` and re-exports the operations (0.9 kB, loaded at start).

### Dashboard

A heading, a row of 4 widgets and 46 more stacked below, each 480 px tall, so only the first row is in the 1280×720 viewport. Each widget is its own component with a list of 6 numbers, a mode and an output line as state, a summary computed from the list, a button that runs a pipeline of 4 list steps and formats the result, and a "Mode" button. [`harness/dashboard.mjs`](./harness/dashboard.mjs) generates the 50 widgets of every framework from a seeded generator, so they run the same handler code, and runs that code in Node to know what each click must show. The generated files are not checked in: each `build:dashboard` script writes them into `dashboard/src/widgets` (`dashboard/src/tags` for Marko).

The idlip widgets are `*.idlip.tsx` modules: `let` for the state, `const` for the summary, function declarations for the two handlers. Two things differ from the other apps, because of the view grammar:

- `<For>` keys by a field, so the list of numbers renders from a derived list of `{ index, value }` entries.
- A view hole has no spread (`Math.max(...items)` fails with `hole-spread`), so the summary is a module-level helper, which the compiler copies into the chunks that use it.

### Scale scenario

The dashboard widgets, generated at N = 10, 50, 200 and 1,000 for idlip, brumate 0.8.1, Marko 6 and Qwik 2. Each widget is its own module, with its own seeded handler code, so the code size grows with N. The page is the dashboard's: a row of 4 widgets and the rest stacked below. Each app has a `scale/` project (`vite.config`, the server entry) and a `build:scale` script that writes the widgets into `scale/src` at build time, with `BENCH_SCALE` as N. Git ignores the generated code.

```bash
node benchmarks/harness/scale.mjs run                       # all sizes, all four frameworks
node benchmarks/harness/scale.mjs run --sizes 10 --only idlip --bytes-only
```

It builds each framework at each size, then measures:

- **Bytes**: one session without throttling loads the page, waits for `networkidle` and 3 s more, then clicks widget 1. It records the HTML (fetched on its own), and the bytes of every other response by phase, raw and gzip -9, split into scripts and the rest. A page is marked `failed`, with the reason, when the click does not show the result that Node computes, when the DOM or the HTML does not hold all N widgets, or when the page throws. A build that fails or a server that does not start in 60 s is `failed` too, with the error.
- **Script and task time**: 10 loads per framework and size with `Emulation.setCPUThrottlingRate` at 4, in a new context each time, with the framework order rotating each round. A warm-up round is dropped. The metrics come from `Performance.getMetrics` right after `load`.

The harness records the load average before and after each size. Timings need a quiet machine, so repeat them when it is quiet. The result goes to `results/scale-<timestamp>.json`. `pnpm -C benchmarks/harness test` builds every framework at 10 widgets and checks that the server renders them.

## Folders

| Folder         | Framework                                                                                                 |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| `idlip/`       | The local `packages/idlip` (`workspace:*`), the page in `src/app.idlip.tsx`, and `rows/` and `dashboard/` |
| `brumate/`     | `brumate` 0.8.1 from npm (exact version in its `package.json`)                                            |
| `brumate-0.3/` | `brumate` 0.3.0 from npm, the lazy-loading design that idlip shares                                       |
| `qwik1/`       | `@builder.io/qwik` 1.20.2 with Vite 7.3.7                                                                 |
| `qwik2/`       | `@qwik.dev/core` 2.0.0-rc.3 with Vite 8.3.4                                                               |
| `marko/`       | `marko` 6.4.6 and `@marko/vite` 6.1.13, Vite 8                                                            |
| `harness/`     | The scripts, with `playwright-core` 1.64.1                                                                |

`brumate/` is a copy of brumate's own benchmark app (`src/`, `rows/`, `dashboard/` and `vite.config.ts`) with the npm package pinned in place of `workspace:*`. To update it, change the version in `package.json` and in the `label` of `adapter.js`, then run `pnpm install`. `marko/rows` and `marko/dashboard` are copies from the same place. The harness files `client.mjs`, `rows.mjs`, `dashboard.mjs` and `profile-rows.mjs` come from brumate's harness; `dashboard.mjs` adds the idlip writer.

The idlip app uses the workspace package, so a run measures the current code. `bench` builds `packages/idlip` first. Its Vite setup and server entry follow `examples/todo`, without the CSP and the nonce, because the other apps have none.

## What it measures

The todos scenario:

- `browser`: Headless Chrome loads `/?n=3` in a fresh context. It records every same-origin response with the phase in which its request started: before `load`, while idle for 3 s after network idle, and during each interaction. Each interaction waits until the DOM shows the expected result. One session clicks the counter first and the other toggles a todo first, so both first interactions run on a page with no earlier clicks. The total covers the counter click, the toggle and an add.
- `dist`: The size of every `.js` file in the client build output, whether the page loads it or not.
- `ssr-size`: The UTF-8 bytes of the HTML for 0, 3 and 100 todos. The worker also checks that the HTML shows the todos, the `N left` line and the counter.
- `ssr-speed`: Each framework renders in its own process. After 300 warm-up renders per size, the runner asks one framework at a time to render for 1 s and counts the renders. Each render includes encoding the HTML to UTF-8 bytes, as a server must before it sends the page. It repeats this for 5 rounds, rotates the order each round, and reports the median with the min and max.
- `waterfall`: Chrome throttles the network to 150 ms of latency and about 1.6 Mbit/s, then clicks the counter. "After idle" throttles after the page loaded and idled. "Cold" throttles from the start and clicks right at `load`. The round trip (RT) count is the longest chain of requests in which each one starts after the previous one finished.

The rows scenario:

- `browser`, the operations of js-framework-benchmark. Each run opens a new page with no rows, does the warmup of the operation (such as 5 creates and clears), and then the click that it measures. Each click waits until the page shows the expected result (row count, first and 999th ID, the label with ` !!!`, the `danger` class on the selected row), so a wrong page fails the run. A Chrome trace of that click gives the main thread time from the start of the click event to the end of the last paint after it. The table shows the median of 10 runs.
- `browser`, the JS heap after creating 1,000 rows, after a garbage collection.
- `browser`, a page that the server rendered with 1,000 rows: the main thread time and longest task while it loads and idles 3 s, the JS heap, and the first select, update and remove, each on its own page. These include idlip's chunk fetch.
- `dist`, `ssr-size` and `ssr-speed`: as for todos, with the page of 1,000 rows. The worker checks that the HTML holds the labels of rows 1 and 1,000.

`node benchmarks/harness/profile-rows.mjs <framework> <create|replace|append> [rounds]` takes a CPU profile of one operation and prints the self time of each function. Build the rows app with `--minify false` first to read the function names.

The dashboard scenario:

- `browser`: three sessions on fresh contexts with the 3 s idle wait. The main one clicks the button of widget 1, scrolls widget 30 into view and clicks it, then scrolls to widget 45 and clicks its Mode button. The second one clicks widget 30 first. The third repeats the main one with the idle preload off, for frameworks that have one (none here). Each click waits until the widget shows the output, mode, summary and list items that the handler computes in Node.
- `dist`, `ssr-size` and `ssr-speed`: as for todos, with the one dashboard page. The worker checks that the HTML shows every widget's title, first item and first mode.
- `waterfall`: as for todos, with a click on the button of widget 1.

## Options

```bash
pnpm -C benchmarks/harness bench --help
pnpm -C benchmarks/harness bench --scenario todos --only idlip,marko,qwik2 --rounds 1
pnpm -C benchmarks/harness bench --scenario rows --only idlip,brumate,marko --rounds 1
pnpm -C benchmarks/harness bench --metrics ssr-size,ssr-speed --no-build
```

| Option                | Default | Meaning                                                 |
| --------------------- | ------- | ------------------------------------------------------- |
| `--scenario <name>`   | all     | `todos`, `rows`, `dashboard`, a list, or `all`.         |
| `--only <names>`      | all     | Frameworks to run, by folder name.                      |
| `--skip <metrics>`    | none    | Metrics to leave out.                                   |
| `--metrics <metrics>` | all     | Metrics to run.                                         |
| `--no-build`          | off     | Use the existing `dist` folders.                        |
| `--rounds <n>`        | 5       | SSR throughput rounds.                                  |
| `--duration <ms>`     | 1000    | Length of one SSR throughput round.                     |
| `--idle <ms>`         | 3000    | Idle wait after load in the browser.                    |
| `--latency <ms>`      | 150     | Latency of the throttled waterfall.                     |
| `--runs <n>`          | 10      | Runs of each operation of the rows scenario.            |
| `--cpu <rate>`        | 1       | CPU slowdown of the measured clicks of rows.            |
| `--install-browser`   | off     | Download Playwright's Chromium when no Chrome is found. |

## Chrome

The browser metrics use `playwright-core` with a Chrome that is already installed. The harness uses `CHROME_PATH` when it is set. Otherwise it looks in the usual install folders on macOS, Linux and Windows. When it finds no Chrome, it prints a message, skips the `browser` and `waterfall` metrics and runs the rest. It downloads a browser only with `--install-browser`.

## Count reader

The harness reads the open count from the `ul + p` element (`harness/count.mjs`), not from the page body. In the body text the last title runs into the count ("Todo number 3" and "2 left" read as "32 left"), so the old reader started from 32 and passed only because it compared against one less. `pnpm -C benchmarks/harness test` renders the idlip page and checks that the body reader gives 32 and the count element gives 2.

## Caveats

- Timings depend on the machine and its load. The report records the CPU, the load average at the start and the end, and notes when the machine was busy. Close other work, or compare runs from the same machine only.
- The SSR throughput runs in-process `render` calls and encodes the result, with no HTTP. It measures the renderer and the encoding, not a server.
- All apps are production builds. Dev servers load different code and are not measured.
- Gzip level 9 runs offline in the harness. A real server may use Brotli or a lower level.
- The servers run on localhost with `cache-control: no-store`. Each browser session starts with an empty cache.
- Qwik preloads code while idle. The "after idle" numbers show that. The "cold" waterfall shows what a click costs before the preload finishes. In the cold run, preload requests that are still in flight count as part of the click.
- The waterfall depth comes from request start and finish times, so it is an estimate.
- The rows page has no stylesheet beyond a few rules, so layout and paint cost less than in js-framework-benchmark. Compare the rows numbers between the frameworks here, not with that site.
- The dashboard widgets come from one generator, so gzip compresses a bundle with all of them better than 50 handlers written by hand. This favors Marko, which ships them in one file. Each lazy chunk of idlip is compressed alone.

## Adding a framework

1. Make a folder here with a `package.json` named `bench-<folder>`, exact dependency versions and a `build` script that writes a production build to `dist/`.
2. Build the same page as the other folders. Keep the markup the harness looks for: the counter `<button>` comes right after an `<h2>`, the todo items are `ul li button`, the `N left` count is the element right after the list (`ul + p`), the done class is `done`, and the form has one `input` and one `button`.
3. Add `adapter.js`. It exports a `label` and an async `load()` that returns `{ staticDir, render }`. `staticDir` is the folder with the client files. `render(n)` returns the full HTML of the page with `n` todos.
4. For rows, add a `rows/` project and a `build:rows` script, and export `loadRows()`, which returns `{ staticDir, render }` with `render(n)` for `n` rows. For the dashboard, add a writer to `harness/dashboard.mjs`, a `build:dashboard` script and a `dashboard/` project, and export `loadDashboard()`, which returns `{ staticDir, render, preloadOption }`.
5. Run `pnpm install`, then `pnpm -C benchmarks/harness bench --only <folder>`.

The harness finds every folder with an `adapter.js`, so no registration is needed.
