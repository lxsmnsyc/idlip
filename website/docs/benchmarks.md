---
title: Benchmarks
order: 91
section: Tools
description: idlip against brumate, Marko 6 and Qwik on todos, rows, a dashboard and apps of 10 to 1,000 widgets. Numbers, method, how to repeat them and where idlip loses.
---

idlip loads the same small file at every app size, and its script time stays flat. Its pages are larger than the others at small sizes, and some first clicks are slower. This page has the numbers, the method and the losses.

## The run

All tables come from one run on 2026-11-23.

- **Commit**: `ed831e4` on `batch/core`, with no benchmark changes.
- **Machine**: Apple M2, 8 cores, 8 GB, macOS, Node 26.12.1, Chrome 158.
- **Load**: every scenario started under a 1-minute load average of 3. Other work was running, so the load was not zero.
- **Versions**: idlip at that commit, brumate 0.8.1 (the latest on npm), Marko 6, Qwik 1 and Qwik 2. Qwik runs only where it has an app, so it is in the todos and scale tables.
- **Build**: production builds, served from localhost with an empty cache. Sizes are gzip -9.

The harness and the apps of the other frameworks come from [brumate's benchmarks](https://github.com/lxsmnsyc/brumate). The author of idlip also wrote brumate.

## What is measured

- **Todos**: a todo list with add and toggle, plus a counter. Items are keyed by ID. The server renders 0, 3 or 100 todos.
- **Rows**: the table of js-framework-benchmark, without its stylesheet. Operations on 1,000 rows (create, replace, update, select, swap, remove, clear) and create on 10,000.
- **Dashboard**: 50 widgets of seeded code, 4 in the first screen and 46 below. Each has state, a computed summary and two buttons.
- **Scale**: the dashboard widgets at 10, 50, 200 and 1,000 distinct components, to see what grows with the app.
- **First click**: the first click after the page is idle at 150 ms round trip, with and without preload links.

idlip pages render `renderPreload` links by default, so its numbers are with links. The links load the chunks of the first click before `load`. They are opt-in and add bytes to every page load. The first-click table shows both.

## Startup and first click

JS before `load` and the first counter click on the todos page, with 3 todos.

| Metric                                     | idlip   | brumate 0.8.1 | Marko 6 | Qwik 1  | Qwik 2  |
| ------------------------------------------ | ------- | ------------- | ------- | ------- | ------- |
| JS before `load`, files                    | 6       | 6             | 1       | 3       | 3       |
| JS before `load`, gzip                     | 5.4 kB  | 15.1 kB       | 4.4 kB  | 22.4 kB | 36.4 kB |
| First counter click after idle, 150 ms RTT | 61 ms   | 80 ms         | 77 ms   | 60 ms   | 79 ms   |
| First counter click cold, 150 ms RTT       | 56 ms   | 108 ms        | 54 ms   | 250 ms  | 500 ms  |
| SSR renders per second, 3 todos            | 135,135 | 113,233       | 141,196 | 16,178  | 9,497   |
| SSR renders per second, 100 todos          | 11,125  | 11,971        | 8,031   | 2,662   | 1,808   |
| SSR HTML, 3 todos, gzip                    | 2.1 kB  | 739 B         | 693 B   | 1.3 kB  | 1.5 kB  |

Renders per second are the median of 5 rounds, in process, without HTTP.

### Preload links on and off

The first click after idle at 150 ms round trip, 21 runs per side, interleaved on one build. Median (median absolute deviation). A change counts when it is larger than 3 times the larger deviation.

| Page, first click   | Links off    | Links on    | Requests, off and on |
| ------------------- | ------------ | ----------- | -------------------- |
| Todos, counter      | 236 ms (5.0) | 69 ms (5.0) | 3 and 0              |
| Dashboard, widget 1 | 250 ms (5.0) | 74 ms (5.0) | 4 and 0              |

Without links the first click costs one round trip. With links it does not, at the price of 5 preloaded files on todos and 21 on the dashboard for every visitor, also those who never click.

## Rows

Main thread from click to paint, in ms. The page has 1,000 rows.

| Operation             | idlip | brumate 0.8.1 | Marko 6 |
| --------------------- | ----- | ------------- | ------- |
| Create 1,000          | 27.9  | 32.7          | 32.4    |
| Replace 1,000         | 31.6  | 28.2          | 26.4    |
| Update every 10th     | 11.5  | 12.3          | 11.3    |
| Select a row          | 1.9   | 1.5           | 1.1     |
| Swap 2 rows           | 8.5   | 6.5           | 6.5     |
| Remove a row          | 8.3   | 7.5           | 7.3     |
| Append 1,000 to 1,000 | 42.3  | 32.2          | 30.1    |
| Create 10,000         | 247.3 | 229.8         | 222.6   |

Differences under 20% are noise on this machine. `benchmarks/README.md` has the rest of the rows table.

## Dashboard

| Metric                                  | idlip             | brumate 0.8.1 | Marko 6       |
| --------------------------------------- | ----------------- | ------------- | ------------- |
| JS before `load`, gzip                  | 10.2 kB, 22 files | 23.3 kB       | 10.5 kB       |
| Click to update, widget 1               | 84 ms             | 82 ms         | 77 ms         |
| Click to update, widget 30 (below fold) | 62 ms             | 41 ms         | 38 ms         |
| Click to update, widget 45              | 47 ms             | 18 ms         | 18 ms         |
| SSR renders per second                  | 4,996             | 4,706         | 6,057         |
| SSR HTML, raw / gzip                    | 93.6 / 8.4 kB     | 33.6 / 6.0 kB | 27.5 / 5.4 kB |

A widget below the fold fetches 3 chunks on its first click, 999 B gzip in total.

## Scale

The same widgets at 10 to 1,000 components. Gzip, kB. Bytes come from two identical runs, timings from the second.

| Metric                            | Widgets | idlip | brumate 0.8.1 | Marko 6 | Qwik 2 |
| --------------------------------- | ------- | ----: | ------------: | ------: | -----: |
| JS before `load`                  | 10      |   4.8 |          15.9 |     5.9 |   37.3 |
|                                   | 200     |   4.8 |          52.6 |    28.1 |   37.3 |
|                                   | 1,000   |   4.8 |         201.5 |   117.8 |   37.3 |
| HTML                              | 10      |   3.4 |           1.8 |     1.7 |    4.3 |
|                                   | 200     |  25.9 |          22.3 |    19.0 |   63.5 |
|                                   | 1,000   | 111.5 |         103.9 |    87.9 |  302.6 |
| All bytes before `load`           | 10      |   8.2 |          17.8 |     7.6 |   42.7 |
|                                   | 200     |  30.7 |          74.9 |    47.1 |  119.3 |
|                                   | 1,000   | 116.4 |         305.3 |   205.8 |  432.1 |
| Script time to `load`, 4x CPU, ms | 10      |   2.3 |           5.2 |     8.2 |    2.5 |
|                                   | 200     |   2.7 |           9.0 |    34.7 |    3.7 |
|                                   | 1,000   |   3.0 |          17.6 |   124.1 |    5.5 |

Raw HTML at 1,000 widgets is 1,865.7 kB for idlip and 579.5 kB for Marko 6. Total main-thread time to `load` is within about 30% for all four frameworks at every size, because most of it is parsing and laying out the page.

## Reading the numbers

### Where idlip wins

- **JS before `load` stays flat.** 4.8 kB gzip from 10 to 1,000 widgets. brumate grows 12.7 times and Marko 20 times. Qwik 2 is flat too, at 37.3 kB, 8 times more.
- **Script time stays flat.** 2.3 to 3.0 ms from 10 to 1,000 widgets, against 5.2 to 17.6 ms for brumate and 8.2 to 124.1 ms for Marko 6. Qwik 2 is close, at 2.5 to 5.5 ms.
- **First click with links.** 61 ms after idle, level with brumate and Marko, and 69 ms against 236 ms without links.
- **Server renders.** On todos with 3 items idlip renders 135,135 per second, ahead of brumate and within 5% of Marko. The dashboard render is ahead of brumate (4,996 against 4,706).
- **Rows.** Create, update and remove are within 20% of both. Create 1,000 is the fastest of the three, inside the noise.

### Total bytes grow with the app

JS on load is flat, but total bytes are not. idlip writes each widget's state and listeners into the HTML, so the page grows with the app.

- **Growth.** All bytes before `load` go from 8.2 kB to 116.4 kB, 14 times, from 10 to 1,000 widgets.
- **Raw HTML.** 1,865.7 kB at 1,000 widgets, 3.2 times Marko 6.
- **Still the smallest total** from 50 widgets up, since the others ship more JS. At 1,000 widgets idlip is at 116.4 kB and Marko 6 at 205.8 kB.
- **At 10 widgets Marko 6 is smaller**, 7.6 kB against 8.2 kB.

The widgets repeat much code, which gzip likes and Marko's single file most. A real app of 1,000 components would compress less.

### Where idlip loses

Rows marked design cost follow from idlip's loading design: no component code runs on load, state is decoded and chunks are imported on the first event, and the page carries state and listeners. Removing them would change the design. Rows marked code cost can be cut by later work.

| Metric                                  | idlip              | Behind                     | Kind        |
| --------------------------------------- | ------------------ | -------------------------- | ----------- |
| Todos, JS before `load`, with links     | 5.4 kB gzip        | Marko 4.4 kB (+23%)        | Design cost |
| Todos, first toggle                     | 48 ms              | brumate 17 ms, Marko 23 ms | Design cost |
| Todos, first add                        | 99 ms              | brumate 47 ms, Marko 49 ms | Design cost |
| Todos, SSR HTML at 0 and 3 todos        | 4.8 and 5.3 kB raw | Marko 812 B and 1.2 kB     | Design cost |
| Todos, SSR HTML at 100 todos            | 20.6 kB raw        | Marko 15.7 kB (+31%)       | Design cost |
| Rows, first select from the server page | 11.3 ms main       | Marko 5.5 ms               | Design cost |
| Dashboard, widgets below the fold       | 62 and 47 ms       | 41 and 18 ms               | Design cost |
| First click without links               | one round trip     | brumate and Marko, none    | Design cost |
| Rows, select, swap, append, clear       | 1.3 to 1.7 times   | Marko                      | Code cost   |
| Client JS emitted in dist, todos        | 6.9 kB gzip        | Marko 4.4 kB (+57%)        | Code cost   |
| Dashboard, SSR renders per second       | 4,996              | Marko 6,057 (1.21 times)   | Code cost   |

`benchmarks/README.md` has the full table, with the reasons, under "Where idlip loses".

## Caveats

- **Noisy machine.** Timings depend on the machine and its load. Read timings that differ by less than 20% as equal.
- **Single sessions.** Most timings come from one session. Close results, such as the todos counter click (1.25 times Marko) and the dashboard render rate, are not confirmed beyond noise.
- **brumate 0.8.1 todos** loaded 35.6 kB before `load` here and 33.3 kB in the run before, with the same version and source. The cause is not known.
- **SSR rates** are in-process `render` calls. They do not include HTTP.
- **Gzip** is level 9 and offline. A real server may use Brotli or a lower level.
- **Widgets** come from one generator, so they compress better than hand-written code.
- **Rows** has almost no stylesheet. Compare the frameworks with each other here, not with js-framework-benchmark.
- **Qwik** preloads all code while idle, so its "before `load`" rows show its startup fairly.

## Repeat it

```bash
uptime   # the 1-minute load should be under 3
pnpm install
pnpm -C benchmarks/harness bench --scenario todos
pnpm -C benchmarks/harness bench --scenario rows
pnpm -C benchmarks/harness bench --scenario dashboard
node benchmarks/harness/scale.mjs run
```

Todos takes about 3 minutes on an Apple M2, rows and dashboard about 15 minutes, and scale builds 16 apps. Results go to `benchmarks/harness/results/`. The first-click table uses `node benchmarks/harness/first-click-ab.mjs --scenario todos --runs 21` with a copy of the build for each side. `benchmarks/README.md` has the steps and every table.
