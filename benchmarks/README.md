# Benchmarks

The todos page of idlip, brumate 0.8.1 (the latest on npm), brumate 0.3.0, Marko 6, Qwik 1 and Qwik 2. Each framework builds the same page, and one script builds, serves and measures all of them. The harness and the non-idlip apps come from [brumate's benchmarks](https://github.com/lxsmnsyc/brumate) (MIT, same author). Only the todos scenario is ported.

```bash
pnpm install
pnpm -C benchmarks/harness bench
```

The command prints a markdown table and writes `results/<timestamp>.json` and `results/<timestamp>.md`. Git ignores the results. A full run takes about 3 minutes on an Apple M2. The workspace lists `benchmarks/*`, but the root `build` and `test` scripts filter to `packages/*` and `examples/*`, no app here has a `typecheck` script, and oxlint ignores the folder.

## Results

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

Not losses: JS before `load` (idlip 9.7 kB / 3.8 kB is 6% above Marko in raw bytes and 14% below in gzip, and well below brumate 0.8.1's 33.3 kB), SSR rate at 100 todos (17% behind brumate 0.8.1 in the table and 17% in the 11-round run, inside the noise; ahead of Marko), and the cost of an extra todo (178 B against 155 B and 153 B).

Reading the table:

- Brumate 0.8.1 loads 33.3 kB before `load` (up from 26.4 kB in 0.3.0) and then needs no request for any click. Brumate 0.3.0 and Qwik fetch some code while idle. idlip fetches nothing while idle, which is the design in the GOAL, and pays on the first click: 2 requests.
- The SSR HTML of idlip is larger because it carries the serialized state and the loader listener. The cost per extra todo is close to the others.
- Marko ships the page as one 9.1 kB file and needs no request, so it wins the click, the render rate at 3 todos and the emitted size.
- The click-to-update times include the chunk fetch for idlip's first click of each kind, so they are not an update cost alone. They vary by 20% or more between runs (an earlier run with load 3.9 gave idlip 87 / 72 / 99 ms and brumate 0.8.1 376 / 47 / 116 ms, where brumate's counter click took 376 ms).

## Scenario

Every app renders the same page:

- A todo list with an input and an Add button. Each item is a button that toggles it done. The list is keyed by ID. Updates make new arrays and objects.
- A `N left` line computed from the list.
- A counter that shows `Clicked N times` and `Double: 2N`.

The server seeds `N` todos, where item `i` is done when `i % 3 === 0`. The page server reads `N` from the `?n=` query parameter, or from the `BENCH_TODOS` environment variable, and defaults to 3. The SSR metrics render 0, 3 and 100 todos.

## Folders

| Folder         | Framework                                                                   |
| -------------- | --------------------------------------------------------------------------- |
| `idlip/`       | The local `packages/idlip` (`workspace:*`), the page in `src/app.idlip.tsx` |
| `brumate/`     | `brumate` 0.8.1 from npm (exact version in its `package.json`)              |
| `brumate-0.3/` | `brumate` 0.3.0 from npm, the lazy-loading design that idlip shares         |
| `qwik1/`       | `@builder.io/qwik` 1.20.2 with Vite 7.3.7                                   |
| `qwik2/`       | `@qwik.dev/core` 2.0.0-rc.3 with Vite 8.3.4                                 |
| `marko/`       | `marko` 6.4.6 and `@marko/vite` 6.1.13, Vite 8                              |
| `harness/`     | The scripts, with `playwright-core` 1.64.1                                  |

`brumate/` is a copy of brumate's own benchmark app (`src/` and `vite.config.ts`, the todos page only) with the npm package pinned in place of `workspace:*`. To update it, change the version in `package.json` and in the `label` of `adapter.js`, then run `pnpm install`. Brumate's harness has no other change that affects the todos numbers; its later changes are the dashboard and rows scenarios.

The idlip app uses the workspace package, so a run measures the current code. `bench` builds `packages/idlip` first. Its Vite setup and server entry follow `examples/todo`, without the CSP and the nonce, because the other apps have none.

## What it measures

- `browser`: Headless Chrome loads `/?n=3` in a fresh context. It records every same-origin response with the phase in which its request started: before `load`, while idle for 3 s after network idle, and during each interaction. Each interaction waits until the DOM shows the expected result. One session clicks the counter first and the other toggles a todo first, so both first interactions run on a page with no earlier clicks. The total covers the counter click, the toggle and an add.
- `dist`: The size of every `.js` file in the client build output, whether the page loads it or not.
- `ssr-size`: The UTF-8 bytes of the HTML for 0, 3 and 100 todos. The worker also checks that the HTML shows the todos, the `N left` line and the counter.
- `ssr-speed`: Each framework renders in its own process. After 300 warm-up renders per size, the runner asks one framework at a time to render for 1 s and counts the renders. Each render includes encoding the HTML to UTF-8 bytes, as a server must before it sends the page. It repeats this for 5 rounds, rotates the order each round, and reports the median with the min and max.
- `waterfall`: Chrome throttles the network to 150 ms of latency and about 1.6 Mbit/s, then clicks the counter. "After idle" throttles after the page loaded and idled. "Cold" throttles from the start and clicks right at `load`. The round trip (RT) count is the longest chain of requests in which each one starts after the previous one finished.

## Options

```bash
pnpm -C benchmarks/harness bench --help
pnpm -C benchmarks/harness bench --scenario todos --only idlip,marko,qwik2 --rounds 1
pnpm -C benchmarks/harness bench --metrics ssr-size,ssr-speed --no-build
```

| Option                | Default | Meaning                                                 |
| --------------------- | ------- | ------------------------------------------------------- |
| `--scenario <name>`   | all     | `todos`, the only scenario.                             |
| `--only <names>`      | all     | Frameworks to run, by folder name.                      |
| `--skip <metrics>`    | none    | Metrics to leave out.                                   |
| `--metrics <metrics>` | all     | Metrics to run.                                         |
| `--no-build`          | off     | Use the existing `dist` folders.                        |
| `--rounds <n>`        | 5       | SSR throughput rounds.                                  |
| `--duration <ms>`     | 1000    | Length of one SSR throughput round.                     |
| `--idle <ms>`         | 3000    | Idle wait after load in the browser.                    |
| `--latency <ms>`      | 150     | Latency of the throttled waterfall.                     |
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

## Adding a framework

1. Make a folder here with a `package.json` named `bench-<folder>`, exact dependency versions and a `build` script that writes a production build to `dist/`.
2. Build the same page as the other folders. Keep the markup the harness looks for: the counter `<button>` comes right after an `<h2>`, the todo items are `ul li button`, the `N left` count is the element right after the list (`ul + p`), the done class is `done`, and the form has one `input` and one `button`.
3. Add `adapter.js`. It exports a `label` and an async `load()` that returns `{ staticDir, render }`. `staticDir` is the folder with the client files. `render(n)` returns the full HTML of the page with `n` todos.
4. Run `pnpm install`, then `pnpm -C benchmarks/harness bench --only <folder>`.

The harness finds every folder with an `adapter.js`, so no registration is needed.
