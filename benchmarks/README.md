# Benchmarks

Three pages, each built by several frameworks: the todos page (idlip, brumate 0.8.1, the latest on npm, brumate 0.3.0, Marko 6, Qwik 1 and Qwik 2), and the rows and dashboard pages (idlip, brumate 0.8.1 and Marko 6). One script builds, serves and measures all of them. The harness and the non-idlip apps come from [brumate's benchmarks](https://github.com/lxsmnsyc/brumate) (MIT, same author).

```bash
pnpm install
pnpm -C benchmarks/harness bench
```

The command prints a markdown table for each scenario and writes `results/<timestamp>.json` and `results/<timestamp>.md`. Git ignores the results. The todos scenario takes about 3 minutes on an Apple M2, and rows and dashboard for three frameworks about 15 minutes with 10 runs. The workspace lists `benchmarks/*`, but the root `build` and `test` scripts filter to `packages/*` and `examples/*`, no app here has a `typecheck` script, and oxlint ignores the folder.

## Results

All tables below come from one run on 2026-11-23, at `batch/core` `ed831e4` (branch `node/perf-from-bench`, no benchmark changes), on an Apple M2 with 8 cores and 8 GB, macOS (darwin 27.0.0), Node 26.12.1 and Chrome 158. Every scenario started only once the 1-minute load average was under 3; the load at the start and end of each is given with its table. Other agents were working on the machine, so the load was not zero. Read timings that differ by less than 20% as equal. Sizes are raw / gzip -9.

The idlip todos, rows and dashboard pages render `renderPreload` links by default, so the idlip numbers in the Todos, Rows and Dashboard tables are with preload links: the chunks of the first click load before `load`, and the first click fetches nothing. The Dashboard table also has a session without the links (`?preload=off`), and [First click, preload on and off](#first-click-preload-on-and-off) has both for todos and the dashboard. The scale page has no links. The previous run (2026-11-21 and 2026-11-22, before `cloned-templates`, `shared-helpers`, `perf-ssr-state`, `perf-list-kept`, the preload links and `text-anchor`) was without links; [Changes since the previous run](#changes-since-the-previous-run) compares the two.

### Todos

`pnpm -C benchmarks/harness bench --scenario todos --no-build` after building every app. Load average 2.76 3.26 4.15 at the start and 1.87 2.90 3.85 at the end. Renders per second are the median of 5 rounds, with the min and max. idlip is with preload links.

| Metric                                     | idlip                     | brumate 0.8.1             | brumate 0.3.0             | Marko 6                   | Qwik 1                 | Qwik 2                 |
| ------------------------------------------ | ------------------------- | ------------------------- | ------------------------- | ------------------------- | ---------------------- | ---------------------- |
| JS before `load`                           | 6 files, 12.2 kB / 5.4 kB | 6, 35.6 kB / 15.1 kB      | 3, 26.4 kB / 11.2 kB      | 1, 9.1 kB / 4.4 kB        | 3, 53.4 kB / 22.4 kB   | 3, 97.2 kB / 36.4 kB   |
| JS fetched while idle 3 s                  | 0                         | 0                         | 3, 1.8 kB / 1.2 kB        | 0                         | 1, 935 B / 452 B       | 9, 2.4 kB / 1.8 kB     |
| First counter click: requests, JS          | 0                         | 0                         | 0                         | 0                         | 0                      | 0                      |
| First todo toggle: requests, JS            | 0                         | 0                         | 0                         | 0                         | 0                      | 0                      |
| Total JS after counter, toggle, add        | 12, 13.4 kB / 6.4 kB      | 6, 35.6 kB / 15.1 kB      | 6, 28.2 kB / 12.4 kB      | 1, 9.1 kB / 4.4 kB        | 4, 54.4 kB / 22.8 kB   | 12, 99.6 kB / 38.2 kB  |
| Click to update (counter / toggle / add)   | 64 / 48 / 99 ms           | 83 / 17 / 47 ms           | 69 / 24 / 48 ms           | 51 / 23 / 49 ms           | 77 / 64 / 65 ms        | 87 / 42 / 83 ms        |
| Client JS emitted in dist                  | 14, 14.0 kB / 6.9 kB      | 9, 87.8 kB / 31.3 kB      | 8, 74.3 kB / 26.6 kB      | 1, 9.1 kB / 4.4 kB        | 5, 55.0 kB / 23.3 kB   | 15, 100.4 kB / 38.8 kB |
| SSR HTML, 0 todos                          | 4.8 kB / 2.0 kB           | 1.2 kB / 608 B            | 960 B / 544 B             | 812 B / 558 B             | 2.3 kB / 1.1 kB        | 3.0 kB / 1.4 kB        |
| SSR HTML, 3 todos                          | 5.3 kB / 2.1 kB           | 1.6 kB / 739 B            | 1.4 kB / 676 B            | 1.2 kB / 693 B            | 2.9 kB / 1.3 kB        | 3.6 kB / 1.5 kB        |
| SSR HTML, 100 todos                        | 20.6 kB / 3.4 kB          | 16.3 kB / 2.2 kB          | 16.1 kB / 2.1 kB          | 15.7 kB / 2.8 kB          | 21.5 kB / 3.9 kB       | 20.7 kB / 3.3 kB       |
| SSR HTML, per extra todo                   | 162 B / 14 B              | 155 B / 15 B              | 155 B / 15 B              | 153 B / 23 B              | 197 B / 28 B           | 181 B / 19 B           |
| SSR renders/s, 3 todos                     | 135,135 (131,861-137,768) | 113,233 (108,351-116,140) | 119,449 (116,459-121,372) | 141,196 (133,647-143,649) | 16,178 (15,550-16,953) | 9,497 (8,679-12,853)   |
| SSR renders/s, 100 todos                   | 11,125 (10,911-11,174)    | 11,971 (11,944-12,127)    | 11,745 (11,361-12,027)    | 8,031 (7,082-8,526)       | 2,662 (753-2,698)      | 1,808 (813-2,544)      |
| First counter click after idle, 150 ms RTT | 61 ms, 0 RT               | 80 ms, 0 RT               | 72 ms, 0 RT               | 77 ms, 0 RT               | 60 ms, 0 RT            | 79 ms, 0 RT            |
| First counter click cold, 150 ms RTT       | 56 ms, 0 RT               | 108 ms, 0 RT              | 182 ms, 1 RT, 3 req       | 54 ms, 0 RT               | 250 ms, 1 RT, 1 req    | 500 ms, 1 RT, 9 req    |

- **idlip's JS before `load`** is the loader (9.9 kB / 4.0 kB), the shared helpers module (2.0 kB / 968 B) and the handler and binding chunks of the counter click and the toggle, five files from the preload links. Without the links the page loads the loader only.
- **The add click** still fetches chunks (the list chunk and the `todos.*.id` and `todos.*.text` bindings), since the links name only the first click's chunks. Its 99 ms includes that fetch on localhost.
- **brumate 0.8.1** loads 6 files and 35.6 kB before `load` in this run against 5 and 33.3 kB in the previous run, with the same package version and app source. The cause was not looked into; it is not idlip code.

### Rows and dashboard

`pnpm -C benchmarks/harness bench --scenario rows --no-build` (load 1.87 2.90 3.85 at the start, 2.64 3.02 3.30 at the end), then `--scenario dashboard --no-build` (load 2.64 3.02 3.30 at the start, 3.18 3.07 3.29 at the end). The rows timings are the median of 10 runs with the min and max. SSR rates are the median of 5 rounds. idlip is with preload links: the rows page names 9 files, the dashboard 21.

#### Rows

Main thread from click to paint, in ms.

| Metric                                                             | idlip                      | brumate 0.8.1        | Marko 6             |
| ------------------------------------------------------------------ | -------------------------- | -------------------- | ------------------- |
| Create 1,000 rows                                                  | 27.9 (23.5-33.8)           | 32.7 (25.7-35.7)     | 32.4 (30.0-33.3)    |
| Replace 1,000 rows                                                 | 31.6 (28.7-33.1)           | 28.2 (25.4-29.6)     | 26.4 (26.0-27.6)    |
| Update every 10th of 1,000 rows                                    | 11.5 (10.2-12.6)           | 12.3 (11.6-13.1)     | 11.3 (9.0-12.0)     |
| Select a row of 1,000                                              | 1.9 (1.6-2.1)              | 1.5 (1.3-1.7)        | 1.1 (1.0-1.3)       |
| Swap 2 of 1,000 rows                                               | 8.5 (7.0-9.2)              | 6.5 (5.1-8.6)        | 6.5 (4.6-8.2)       |
| Remove a row of 1,000                                              | 8.3 (7.8-11.1)             | 7.5 (6.4-8.4)        | 7.3 (6.5-8.4)       |
| Create 10,000 rows                                                 | 247.3 (226.5-257.0)        | 229.8 (202.6-240.3)  | 222.6 (210.4-227.1) |
| Append 1,000 rows to 1,000                                         | 42.3 (38.9-43.7)           | 32.2 (30.9-33.6)     | 30.1 (27.5-33.6)    |
| Clear 1,000 rows                                                   | 3.7 (3.0-4.4)              | 3.7 (3.5-4.1)        | 2.8 (2.6-3.5)       |
| JS heap after creating 1,000 rows                                  | 2.4 MB                     | 2.6 MB               | 2.6 MB              |
| Server page, 1,000 rows: main thread busy during load and 3 s idle | 52.4 (45.2-59.9)           | 52.0 (49.3-53.3)     | 51.7 (50.3-57.7)    |
| Server page: longest task                                          | 20.5 (18.9-21.5)           | 20.5 (19.9-20.9)     | 23.2 (21.8-25.8)    |
| Server page: JS heap                                               | 0.8 MB                     | 1.4 MB               | 1.3 MB              |
| First select from the server page, main thread / to paint          | 11.3 / 31.4                | 6.2 / 14.4           | 5.5 / 14.7          |
| First update every 10th from the server page                       | 21.2 / 38.3                | 24.2 / 27.6          | 24.0 / 27.7         |
| First remove from the server page                                  | 27.4 / 41.9                | 20.4 / 24.9          | 20.2 / 24.1         |
| Client JS emitted in dist                                          | 17 files, 15.1 kB / 7.4 kB | 7, 85.1 kB / 29.9 kB | 1, 9.3 kB / 4.5 kB  |
| SSR HTML, 1,000 rows                                               | 328.2 kB / 23.4 kB         | 307.2 kB / 24.3 kB   | 269.4 kB / 31.8 kB  |
| SSR renders/s, 1,000 rows                                          | 1,115 (1,039-1,149)        | 1,216 (1,165-1,245)  | 814 (813-822)       |

Every operation passes the page checks. The create 1,000 times of brumate 0.8.1 and Marko are about 50% above their previous run (22.1 and 21.0 ms) while idlip's fell; the min-max ranges overlap, so read create 1,000 as even among the three. The first clicks from a server page include idlip's first-event work: the state script is decoded and the preloaded chunks are imported on the click.

#### Dashboard

| Metric                                                          | idlip                       | brumate 0.8.1         | Marko 6              |
| --------------------------------------------------------------- | --------------------------- | --------------------- | -------------------- |
| JS before `load`                                                | 22 files, 20.1 kB / 10.2 kB | 4, 110.6 kB / 23.3 kB | 1, 66.7 kB / 10.5 kB |
| JS fetched while idle 3 s                                       | 0                           | 0                     | 0                    |
| First click, widget 1: requests, JS                             | 0                           | 0                     | 0                    |
| First click, widget 30 (below the fold): JS on scroll, on click | 0; 3, 999 B / 700 B         | 0                     | 0                    |
| Widget 30 after widget 1 (scroll and click)                     | 3, 999 B / 700 B            | 0                     | 0                    |
| Widget 45 Mode after both (scroll and click)                    | 3, 610 B / 529 B            | 0                     | 0                    |
| Total JS after 3 widgets                                        | 28, 21.7 kB / 11.4 kB       | 4, 110.6 kB / 23.3 kB | 1, 66.7 kB / 10.5 kB |
| Click to update (widget 1 / 30 / 45)                            | 84 / 62 / 47 ms             | 82 / 41 / 18 ms       | 77 / 38 / 18 ms      |
| Without links: first click, widget 1                            | 4, 2.3 kB / 1.4 kB          | n/a                   | n/a                  |
| Without links: total JS after 3 widgets                         | 11, 16.2 kB / 7.4 kB        | n/a                   | n/a                  |
| Without links: click to update (widget 1 / 30 / 45)             | 73 / 58 / 49 ms             | n/a                   | n/a                  |
| Client JS emitted in dist                                       | 365, 153.4 kB / 104.2 kB    | 7, 162.8 kB / 39.5 kB | 1, 66.7 kB / 10.5 kB |
| SSR HTML                                                        | 93.6 kB / 8.4 kB            | 33.6 kB / 6.0 kB      | 27.5 kB / 5.4 kB     |
| SSR renders/s                                                   | 4,996 (4,549-5,038)         | 4,706 (3,843-4,821)   | 6,057 (5,649-6,867)  |
| First click on widget 1 after idle, 150 ms RTT                  | 67 ms, 0 RT                 | 95 ms, 0 RT           | 81 ms, 0 RT          |
| First click on widget 1 cold, 150 ms RTT                        | 72 ms, 0 RT                 | 482 ms, 0 RT          | 84 ms, 0 RT          |

The "without links" rows are the harness's preload-off session (`?preload=off`). Neither brumate 0.8.1 nor Marko has an idle preload to turn off. With links idlip loads 10.2 kB gzip before `load`, about the same as Marko's 10.5 kB, in 22 files: the loader (12.6 kB / 4.8 kB), the helpers module and the 20 chunks of the 4 widgets above the fold. A widget below the fold still fetches 3 chunks on its first click.

### First click, preload on and off

The first click after idle at 150 ms latency, interleaved between the two idlip pages of one build, on 2026-11-23. N = 21 runs per side, fixed before the run, one warmup run dropped. Todos: load average 2.72 at the start and 4.06 at the end. Dashboard: 2.80 at the start and 3.17 at the end. Median (median absolute deviation); a change is real when it is larger than 3 times the larger deviation.

- **off**: no preload links. The click fetches its chunks.
- **links**: `renderPreload` links in the head, as the pages render them. The click imports modules the browser already fetched.

"Click to update" is the harness's waterfall number: from the Playwright click call to the check passing, polled every 5 ms. "Click to write" and "click to frame" use the page's own clock from the click event: to the first DOM change, and to a task queued from the next animation frame after it. They leave out the Playwright round trips.

| Todos, counter  | off            | links         |
| --------------- | -------------- | ------------- |
| Requests        | 3              | 0             |
| Click to update | 236.0 ms (5.0) | 69.0 ms (5.0) |
| Click to write  | 189.7 ms (2.2) | 16.4 ms (0.5) |
| Click to frame  | 190.9 ms (2.1) | 31.2 ms (0.4) |

| Dashboard, widget 1 | off            | links         |
| ------------------- | -------------- | ------------- |
| Requests            | 4              | 0             |
| Click to update     | 250.0 ms (5.0) | 74.0 ms (5.0) |
| Click to write      | 197.8 ms (2.9) | 17.9 ms (0.8) |
| Click to frame      | 199.5 ms (2.5) | 31.9 ms (0.4) |

- **The links remove the round trip**: 236 and 250 ms down to 69 and 74 ms (-71% and -70%, noise 15 ms), as in the `preimport-chunks` run (232 to 66 ms and 247 to 68 ms). In the waterfall of this run brumate 0.8.1 measured 80 ms (todos) and 95 ms (dashboard), Marko 77 and 81 ms, so with the links idlip is in the same range on the same loading choice: the click's code fetched before the click.
- **Cost**: the links add the first click's chunks to every page load, also for visitors who never click: 5 files for todos (the helpers module and the handler and binding chunks of the counter and the toggle), 21 for the dashboard (the helpers and 20 chunks). In the todos table that is 12.2 kB / 5.4 kB before `load` against the 9.9 kB / 4.0 kB loader alone.
- **Dropped: importing the preloaded modules at idle.** A loader option imported every modulepreload of the page after `load`, as brumate `af923d74` does. Against "links" it moved the DOM write from 15.9 to 2.9 ms (todos) and 17.6 to 4.6 ms (dashboard), but the frame only from 31.3 to 28.0 and 31.7 to 28.9 ms, within the noise, and the harness number trended slower (73 and 72 ms, within the noise). It cost 86 B gzip of loader and ran third-party modulepreloads too, so it was removed (`preimport-chunks`, 2026-11-22).

`benchmarks/prefetch/run.mjs --rounds 20 --no-build` (2026-11-22, not rerun; the todos page with and without links, click right at `load`, load 2.6 to 2.8): click to update 227 ms (224-234) off and 60 ms (53-66) on; navigation to update 617 ms against 489 ms; `load` 389 ms against 432 ms, since the preloads delay it.

To repeat (copy `dist` away first, so the server modules of each side stay apart):

```bash
uptime   # 1-minute load under 3
pnpm -C benchmarks/idlip build   # copy benchmarks/idlip/dist to links/
node benchmarks/harness/first-click-ab.mjs --scenario todos --runs 21 \
  --side off=links:off --side links=links
```

For the dashboard, build with `build:dashboard` and copy `benchmarks/idlip/dashboard/dist`.

### Scale

Does startup stay flat as the app grows? One page per size, with N distinct widget components (N = 10, 50, 200 and 1,000), built by idlip, brumate 0.8.1, Marko 6 and Qwik 2. The widgets are the dashboard's (see [Scale scenario](#scale-scenario)). `node benchmarks/harness/scale.mjs run`, twice, on 2026-11-23. Every page passed its checks in both runs: all widgets in the HTML and the DOM, a first click that shows what Node computes, and no page errors.

Bytes are exact and do not depend on load; both runs gave the same bytes (brumate's gzip moved by a few bytes). Both runs started under a 1-minute load of 3, but the builds the script runs before each size pushed it above. The timings are from the second run, which had the lower load (1-minute load before and after each size: 10 widgets 2.53 and 3.65; 50 widgets 3.65 and 3.83; 200 widgets 3.83 and 4.13; 1,000 widgets 4.13 and 5.28). The first run (2.69 to 3.11 at 10 widgets, then up to 6.9) agrees on script times within 10%, except idlip at 50 widgets (2.7 against 3.2 ms), and on task times within 5%.

Gzip -9, kB. "Before the first click" is the page load plus a 3 s idle wait. "All bytes" adds up the HTML, the JS and every other fetch (Qwik 2's `bundle-graph.json` and similar).

| Metric                                | App   | idlip | brumate 0.8.1 | Marko 6 |  Qwik 2 |
| ------------------------------------- | ----- | ----: | ------------: | ------: | ------: |
| JS before `load`                      | 10    |   4.8 |          15.9 |     5.9 |    37.3 |
|                                       | 50    |   4.8 |          23.8 |    10.8 |    37.3 |
|                                       | 200   |   4.8 |          52.6 |    28.1 |    37.3 |
|                                       | 1,000 |   4.8 |         201.5 |   117.8 |    37.3 |
| JS before the first click             | 10    |   4.8 |          15.9 |     5.9 |    51.2 |
|                                       | 50    |   4.8 |          23.8 |    10.8 |   106.3 |
|                                       | 200   |   4.8 |          52.6 |    28.1 |   312.0 |
|                                       | 1,000 |   4.8 |         201.5 |   117.8 | 1,409.1 |
| JS fetched by the first click         | every |   1.5 |             0 |       0 |       0 |
| HTML                                  | 10    |   3.4 |           1.8 |     1.7 |     4.3 |
|                                       | 50    |   8.4 |           6.2 |     5.6 |    16.5 |
|                                       | 200   |  25.9 |          22.3 |    19.0 |    63.5 |
|                                       | 1,000 | 111.5 |         103.9 |    87.9 |   302.6 |
| Non-JS fetches before the first click | 10    |   0.0 |           0.0 |     0.0 |     1.0 |
|                                       | 50    |   0.0 |           0.0 |     0.0 |     4.7 |
|                                       | 200   |   0.0 |           0.0 |     0.0 |    18.5 |
|                                       | 1,000 |   0.0 |           0.0 |     0.0 |    92.2 |
| All bytes before `load`               | 10    |   8.2 |          17.8 |     7.6 |    42.7 |
|                                       | 50    |  13.3 |          30.0 |    16.3 |    58.5 |
|                                       | 200   |  30.7 |          74.9 |    47.1 |   119.3 |
|                                       | 1,000 | 116.4 |         305.3 |   205.8 |   432.1 |
| All bytes before the first click      | 10    |   8.2 |          17.8 |     7.6 |    56.6 |
|                                       | 50    |  13.3 |          30.0 |    16.3 |   127.5 |
|                                       | 200   |  30.7 |          74.9 |    47.1 |   394.0 |
|                                       | 1,000 | 116.4 |         305.3 |   205.8 | 1,803.9 |

Raw sizes, kB. idlip's JS is 12.6 kB at every size, one file. Its HTML is 20.5, 94.3, 373.3, 1,865.7 kB, against 5.9, 28.2, 113.7, 579.5 kB for Marko 6. brumate's HTML is 7.3 to 696.9 kB and Qwik 2's 14.8 to 1,382.7 kB. Raw JS at 1,000 widgets: brumate 1,699.1 kB, Marko 1,226.9 kB, Qwik 2 99.4 kB before `load` and 2,179.1 kB before the first click.

Main-thread time from navigation to `load`, 4x CPU slowdown, median of 10 loads, ms:

| Metric      | App   | idlip | brumate 0.8.1 | Marko 6 | Qwik 2 |
| ----------- | ----- | ----: | ------------: | ------: | -----: |
| Script time | 10    |   2.3 |           5.2 |     8.2 |    2.5 |
|             | 50    |   3.2 |           6.3 |    15.2 |    2.8 |
|             | 200   |   2.7 |           9.0 |    34.7 |    3.7 |
|             | 1,000 |   3.0 |          17.6 |   124.1 |    5.5 |
| Task time   | 10    |    53 |            57 |      56 |     54 |
|             | 50    |    69 |            72 |      78 |     68 |
|             | 200   |   129 |           122 |     148 |    122 |
|             | 1,000 |   445 |           431 |     505 |    387 |

Script time is the time the page spends running scripts (CDP `ScriptDuration`). Task time is all main-thread work (`TaskDuration`), which includes parsing the HTML and laying out N widgets of 480 px each, so it grows for every framework and is mostly the page, not the framework.

What the numbers say:

- **JS on load is flat for idlip**: 4.8 kB gzip from 10 to 1,000 widgets, one file (the dashboard loader with its features). The first click fetches 1.5 kB more: the helpers module and the widget's chunks. brumate grows 12.7x and Marko 20x from 10 to 1,000 widgets. Qwik 2 is flat too, at 37.3 kB.
- **Qwik 2 keeps loading while idle.** Its JS before the first click grows with the app (51.2 kB to 1,409.1 kB), because it preloads the code of every widget. That is background work, not part of `load`, so the "before `load`" rows are the fairer view of its startup. The landing chart uses them.
- **Total bytes are not flat for idlip.** All bytes before the first click go from 8.2 to 116.4 kB, 14x. The HTML is the cost: idlip writes each widget's state and listeners into the page, 1.9 MB raw at 1,000 widgets, 3.2x Marko 6's HTML. It still has the fewest bytes from 50 widgets up (16.3 kB for Marko 6 at 50 widgets and 205.8 kB at 1,000). At 10 widgets Marko 6 is smaller (7.6 kB against 8.2 kB).
- **Script time is flat for idlip** (2.3 to 3.2 ms) and for Qwik 2 (2.5 to 5.5 ms). Marko 6 grows 15x, brumate 3.4x.
- **Task time does not separate the frameworks.** All four are within about 30% of each other at every size (53 to 445 ms for idlip, 54 to 387 ms for Qwik 2).

Against the 2026-11-22 run: idlip's JS on load went from 4.7 to 4.8 kB gzip (12.5 to 12.6 kB raw, the loader), its HTML at 1,000 widgets from 2,001.2 to 1,865.7 kB raw (`text-anchor` and `perf-ssr-state`), and its first click from about 1 kB to 1.5 kB (the helpers module of `shared-helpers` loads with the first click). The other frameworks' bytes did not change, and the timings agree within the spread of both runs.

The widgets are made from 17 handler steps and 12 formatters with random constants, so 1,000 of them repeat much code. That helps every bundler's gzip and Marko most, which ships one file. A real app of 1,000 components would compress less.

### Where idlip loses

Each row is a metric of this run where idlip is behind brumate 0.8.1 or Marko 6 by more than 20%. Ratios are idlip over the other. **Design cost** marks a loss that follows from idlip's loading design (no component code runs on load, state is decoded and chunks are imported on the first event, and the page carries the state and the listeners in its HTML). Removing it would mean changing the design, not the code. The other rows are code costs that later work can cut.

| Metric                                        | idlip                            | Behind                                           | Gap                                                | Kind                                                                                                                                             |
| --------------------------------------------- | -------------------------------- | ------------------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Todos: JS before `load`, with links           | 12.2 kB / 5.4 kB, 6 files        | Marko 9.1 kB / 4.4 kB, 1 file                    | +34% raw, +23% gzip                                | Design cost of the links: 5 preloaded chunks next to the loader. Without links it is the loader alone, 9.9 kB / 4.0 kB, below Marko in gzip.     |
| Todos: total JS after counter, toggle, add    | 13.4 kB / 6.4 kB, 12 files       | Marko 9.1 kB / 4.4 kB, 1 file                    | +47% raw, +45% gzip                                | Code: the loader is 9.9 kB / 4.0 kB on its own.                                                                                                  |
| Todos: client JS in dist                      | 14.0 kB / 6.9 kB                 | Marko 9.1 kB / 4.4 kB                            | +54% raw, +57% gzip                                | Code: as above.                                                                                                                                  |
| Todos: click to update, toggle                | 48 ms                            | brumate 17 ms, Marko 23 ms                       | 2.8x, 2.1x                                         | Design cost: the first toggle decodes the state script and imports the preloaded chunks.                                                         |
| Todos: click to update, add                   | 99 ms                            | brumate 47 ms, Marko 49 ms                       | 2.1x, 2.0x                                         | Design cost: the add fetches 3 chunks the links do not name.                                                                                     |
| Todos: click to update, counter               | 64 ms                            | Marko 51 ms (brumate 83 ms is behind idlip)      | 1.25x                                              | Design cost: first event, as the toggle. Single session, close to the 20% line.                                                                  |
| Todos: SSR HTML, 0 and 3 todos                | 4.8 kB / 2.0 kB, 5.3 kB / 2.1 kB | brumate 1.2 kB, 1.6 kB; Marko 812 B, 1.2 kB      | 4.0x and 3.3x raw; 5.9x and 4.4x raw               | Design cost: the state script, the inline listener (1.7 kB / 1.0 kB) and the 5 preload links.                                                    |
| Todos: SSR HTML, 100 todos                    | 20.6 kB / 3.4 kB                 | brumate 16.3 kB / 2.2 kB, Marko 15.7 kB / 2.8 kB | +26% and +31% raw; +55% and +21% gzip              | Design cost: the state script holds the 100 todos next to the markup.                                                                            |
| Rows: select a row                            | 1.9 ms                           | brumate 1.5, Marko 1.1                           | 1.27x, 1.7x                                        | Code: a change of `selected` runs the row class binding on every kept row (`perf-list-kept` keeps that rule; the skip moved to `row-own-reads`). |
| Rows: swap 2 rows                             | 8.5 ms                           | 6.5, 6.5                                         | 1.31x, 1.31x                                       | Code: `readRows` and the kept-row binding pass on 1,000 rows. The unsound skip that made swap faster was removed in `perf-list-kept`.            |
| Rows: append 1,000 rows to 1,000              | 42.3 ms                          | 32.2, 30.1                                       | 1.31x, 1.41x                                       | Code: the kept-row pass on the 1,000 kept rows, plus the clone of the new rows.                                                                  |
| Rows: clear 1,000 rows                        | 3.7 ms                           | Marko 2.8 (brumate 3.7 is even)                  | 1.32x                                              | Code: `removeRange` per row where Marko clears the parent at once.                                                                               |
| Rows: first select from the server page       | 11.3 / 31.4 ms                   | 6.2 / 14.4, 5.5 / 14.7                           | 1.8x, 2.1x main; 2.2x, 2.1x to paint               | Design cost: the first event decodes the state script and imports the preloaded chunks, then runs the select.                                    |
| Rows: first update every 10th, to paint       | 38.3 ms                          | 27.6, 27.7                                       | 1.39x (main thread 21.2 ms is ahead)               | Design cost: first event, as above.                                                                                                              |
| Rows: first remove from the server page       | 27.4 / 41.9 ms                   | 20.4 / 24.9, 20.2 / 24.1                         | 1.34x main, 1.7x to paint                          | Design cost: first event, as above.                                                                                                              |
| Rows: client JS in dist                       | 15.1 kB / 7.4 kB                 | Marko 9.3 kB / 4.5 kB                            | +62% raw, +64% gzip                                | Code: the loader, the helpers module and the page's small chunks, 17 files.                                                                      |
| Rows: SSR HTML, raw                           | 328.2 kB                         | Marko 269.4 kB (brumate 307.2 kB, +7%)           | +22%                                               | Design cost: the state script with the 1,000-row model and the row markers. In gzip idlip is the smallest (23.4 kB).                             |
| Dashboard: click to update, widgets 30 and 45 | 62, 47 ms                        | 41, 18 and 38, 18                                | 1.5x and 2.6x; 1.6x and 2.6x                       | Design cost: a widget below the fold fetches 3 chunks on its first click.                                                                        |
| Dashboard: client JS in dist                  | 365 files, 153.4 kB / 104.2 kB   | brumate 162.8 / 39.5, Marko 66.7 / 10.5          | 2.6x gzip (raw is 6% smaller); 2.3x raw, 9.9x gzip | Code and design: about 7 chunks per widget, each gzipped alone. Only the chunks a click needs load, so this is not what a visitor downloads.     |
| Dashboard: SSR HTML                           | 93.6 kB / 8.4 kB                 | 33.6 / 6.0, 27.5 / 5.4                           | 2.8x, 3.4x raw; +40%, +56% gzip                    | Design cost and code: the state script (chunk URL map and manifests) and 21 preload links. `perf-ssr-state` cut the state script by 10.4 kB.     |
| Dashboard: SSR renders/s                      | 4,996                            | Marko 6,057 (brumate 4,706 is behind idlip)      | 1.21x                                              | Code: seroval writes the per-render state. At the 20% line.                                                                                      |

Without links (`?preload=off`, the design the GOAL describes) the first click of each page also costs one round trip: 236 ms (todos) and 250 ms (dashboard) at 150 ms latency, against 69 and 74 ms with links and 77 to 95 ms for brumate 0.8.1 and Marko. That is a design cost; the links are the answer, opt-in through `renderPreload`.

No longer losses, compared with the previous run:

- **Todos SSR renders/s at 3 todos**: 135,135, ahead of brumate 0.8.1 (113,233) and within 5% of Marko (141,196). It was 2.3x behind both (`perf-ssr-state`).
- **First click at 150 ms RTT**, todos and dashboard, with links: 61 and 67 ms after idle, ahead of brumate and Marko. It was 220 and 219 ms (`preimport-chunks`).
- **Todos first click and first toggle requests**: 0 with links. They were 2 requests.
- **Rows create 1,000, replace, create 10,000, update every 10th, remove**: within 20% of both in this run. They were 1.3x to 1.8x behind (`cloned-templates`, `perf-list-kept`). Create 1,000 is the fastest of the three here, inside the spread.
- **Dashboard SSR renders/s against brumate**: ahead. It was 2.5x behind (`perf-ssr-state`).
- **Dashboard click to update, widget 1**: even with both (84 against 82 and 77 ms). It was 1.3x behind.

Not losses in this run: the JS heap (idlip is the smallest), the main thread while the 1,000-row server page loads, SSR rate at 1,000 rows (8% behind brumate, ahead of Marko), SSR HTML of 1,000 rows in gzip, todos SSR rate at 100 todos (7% behind brumate, ahead of Marko), the cost of an extra todo (162 B against 155 B and 153 B), dashboard JS before `load` (10.2 kB gzip with links against Marko's 10.5 kB) and total JS after 3 widgets (11.4 kB gzip against 10.5 kB, within 20%; 7.4 kB without links, the least).

### Perf work since the previous run

Each perf node's claim, and whether this run shows it. Cross-run comparisons of timings carry the load difference between the runs. Where the other frameworks moved too, the ratio to them is given.

| Node                   | Claimed                                                                                        | This run                                                                                                                                                                                 | Shown      |
| ---------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `cloned-templates`     | Rows create 10,000 -22% and append -15% beyond noise; create 1,000 and replace within noise    | Create 10,000 380.8 to 247.3 ms (1.60x to 1.11x Marko), append 62.0 to 42.3 ms (2.22x to 1.41x), create 1,000 35.4 to 27.9 ms (1.69x to 0.86x), replace 42.9 to 31.6 ms (1.78x to 1.20x) | Yes        |
| `cloned-templates-all` | No speed change; the todo toggle 65 to 49 ms in both pairs                                     | Toggle 48 ms (56 ms in the previous run, without links). No other claim to check                                                                                                         | Consistent |
| `shared-helpers`       | Dashboard dist -31% gzip; later chunks smaller; a larger first click                           | Dashboard dist 104.2 kB gzip (146.9 kB before, harness measure in that node); widget 30 after widget 1: 999 B / 700 B against 1.5 kB / 953 B; widget 1 without links 4 requests, 1.4 kB  | Yes        |
| `perf-ssr-state`       | Dashboard SSR 918 to 4,746 renders/s, todos 33,710 to 129,100; dashboard state script -10.4 kB | Dashboard 953 to 4,996 renders/s (0.24x to 1.06x brumate), todos 3 todos 36,047 to 135,135 (0.44x to 1.19x brumate); dashboard HTML 108.8 to 93.6 kB with `text-anchor`                  | Yes        |
| `preimport-chunks`     | First click after idle 232 to 66 ms (todos), 247 to 68 ms (dashboard) with links               | 236 to 69 ms and 250 to 74 ms, real by 3x MAD                                                                                                                                            | Yes        |
| `perf-list-kept`       | Script time: select -47%, remove -19%; swap, update every 10th, clear, append within noise     | Click to paint: select 4.3 to 1.9 ms (3.6x to 1.7x Marko), remove 11.4 to 8.3 ms (1.8x to 1.14x), swap 9.7 to 8.5 ms (2.2x to 1.31x), clear 5.1 to 3.7, update every 10th 13.5 to 11.5   | Yes        |
| `text-anchor`          | SSR HTML: -16 B per todo, -26 B per row (rows page -26,000 B), dashboard -4,000 B              | Per extra todo 178 to 162 B; rows page 353.0 to 328.2 kB (the 9 preload links add about 0.6 kB); dashboard 108.8 to 93.6 kB (with `perf-ssr-state`)                                      | Yes        |
| `fix-for-prop-each`    | A correctness fix, no speed claim                                                              | n/a                                                                                                                                                                                      | n/a        |
| `bench-scale`          | The scale scenario                                                                             | Rerun in [Scale](#scale)                                                                                                                                                                 | n/a        |
| `perf-list-create`     | Nothing shipped                                                                                | n/a                                                                                                                                                                                      | n/a        |

### Changes since the previous run

Regressions beyond noise against the previous README numbers:

- **JS before `load` grew** on the todos page (3.8 to 5.4 kB gzip) and the dashboard (4.6 to 10.2 kB gzip). This is the preload links, by choice, and it buys the first click (see above). Without links the loader alone is 4.0 kB and 4.8 kB gzip.
- **SSR HTML at 0 and 3 todos grew** by about 0.4 kB raw (4.4 to 4.8 kB and 4.9 to 5.3 kB): the 5 preload links. At 100 todos it shrank (21.8 to 20.6 kB) with `text-anchor`.
- **Dashboard click to update, widget 30**: 47 ms in the previous run, 62 ms here (58 ms in the session without links). Both are single sessions, and the `cloned-templates-all` pairs measured 54 to 60 ms on its base and its branch, so this may have moved before that node. Not confirmed beyond noise.
- **Rows client JS in dist**: 14.8 kB / 7.1 kB to 15.1 kB / 7.4 kB (+0.3 kB gzip), from the cloned templates and the helpers module.

- **Dashboard click to update, widget 1**: 69 to 84 ms (+22%, at the 20% line), a single session. The session without links measured 73 ms. Not confirmed beyond noise.

Nothing else is slower or larger beyond noise. The todos add click (95 to 99 ms) is inside the 20% band.

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

The idlip page is `idlip/rows/src/app.tsx`, with `<For each={rows} key={(item) => item.id}>`. Every operation is expressible, swap included. Its handlers call the list operations of `rows.mjs`, and the idlip Vite plugin rejects a handler chunk that imports a chunk the loader does not import, so the loader is `idlip/rows/src/loader.ts`: it imports `idlip/client` and re-exports the operations (0.9 kB, loaded at start).

### Dashboard

A heading, a row of 4 widgets and 46 more stacked below, each 480 px tall, so only the first row is in the 1280×720 viewport. Each widget is its own component with a list of 6 numbers, a mode and an output line as state, a summary computed from the list, a button that runs a pipeline of 4 list steps and formats the result, and a "Mode" button. [`harness/dashboard.mjs`](./harness/dashboard.mjs) generates the 50 widgets of every framework from a seeded generator, so they run the same handler code, and runs that code in Node to know what each click must show. The generated files are not checked in: each `build:dashboard` script writes them into `dashboard/src/widgets` (`dashboard/src/tags` for Marko).

The idlip widgets are `*.tsx` modules: `let` for the state, `const` for the summary, function declarations for the two handlers. Two things differ from the other apps, because of the view grammar:

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

| Folder         | Framework                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------- |
| `idlip/`       | The local `packages/idlip` (`workspace:*`), the page in `src/app.tsx`, and `rows/` and `dashboard/` |
| `brumate/`     | `brumate` 0.8.1 from npm (exact version in its `package.json`)                                      |
| `brumate-0.3/` | `brumate` 0.3.0 from npm, the lazy-loading design that idlip shares                                 |
| `qwik1/`       | `@builder.io/qwik` 1.20.2 with Vite 7.3.7                                                           |
| `qwik2/`       | `@qwik.dev/core` 2.0.0-rc.3 with Vite 8.3.4                                                         |
| `marko/`       | `marko` 6.4.6 and `@marko/vite` 6.1.13, Vite 8                                                      |
| `harness/`     | The scripts, with `playwright-core` 1.64.1                                                          |

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

`node benchmarks/harness/first-click-ab.mjs` interleaves the "after idle" waterfall run between idlip builds of the todos or dashboard page, with the page-clock times described in [First click, preload on and off](#first-click-preload-on-and-off). Each `--side name=<dist>` serves one build, and `name=<dist>:off` serves it without preload links. `?preload=off` turns the links off on the idlip pages served by `serve.mjs`.

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
