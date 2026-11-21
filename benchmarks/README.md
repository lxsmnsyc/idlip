# Benchmarks

The todos page of idlip, brumate 0.3.0, Marko 6, Qwik 1 and Qwik 2. Each framework builds the same page, and one script builds, serves and measures all of them. The harness and the non-idlip apps come from [brumate's benchmarks](https://github.com/lxsmnsyc/brumate) (MIT, same author). Only the todos scenario is ported.

```bash
pnpm install
pnpm -C benchmarks/harness bench
```

The command prints a markdown table and writes `results/<timestamp>.json` and `results/<timestamp>.md`. Git ignores the results. A full run takes about 2.5 minutes on an Apple M2. The workspace lists `benchmarks/*`, but the root `build` and `test` scripts filter to `packages/*` and `examples/*`, no app here has a `typecheck` script, and oxlint ignores the folder.

## Results

A run of `pnpm -C benchmarks/harness bench --scenario todos` on branch `benchmarks` at `fd94156` (the benchmark files were uncommitted), on 2026-11-21. The machine was an Apple M2 with 8 GB, Node 26.12.1 and Chrome 158. It was busy: other agents were building and testing at the same time (load average 4.76 at the start, 3.13 at the end, 6.6 a minute earlier). Read timings that differ by less than about 20% as equal. Sizes are raw / gzip -9. Renders per second are the median of 5 rounds.

| Metric                                             |            idlip |     brumate 0.3.0 |         Marko 6 |            Qwik 1 |            Qwik 2 |
| -------------------------------------------------- | ---------------: | ----------------: | --------------: | ----------------: | ----------------: |
| JS before `load`                                   | 10.0 kB / 4.0 kB | 26.4 kB / 11.2 kB | 9.1 kB / 4.4 kB | 53.4 kB / 22.4 kB | 97.2 kB / 36.4 kB |
| Total JS after counter, toggle and add             | 14.0 kB / 6.5 kB | 28.2 kB / 12.3 kB | 9.1 kB / 4.4 kB | 54.4 kB / 22.8 kB | 99.6 kB / 38.2 kB |
| First counter click: JS                            |    473 B / 351 B |               0 B |             0 B |               0 B |               0 B |
| First todo toggle: JS                              |    997 B / 613 B |               0 B |             0 B |               0 B |               0 B |
| SSR HTML, 3 todos                                  |  4.6 kB / 1.9 kB |    1.4 kB / 674 B |  1.2 kB / 692 B |   2.9 kB / 1.3 kB |   3.6 kB / 1.5 kB |
| SSR renders/s, 3 todos                             |           61,286 |           118,654 |         140,031 |            17,003 |            11,459 |
| SSR renders/s, 100 todos                           |           10,442 |            11,207 |           9,034 |             2,689 |             1,809 |
| First counter click right after `load`, 150 ms RTT |     354 ms, 2 RT |      190 ms, 1 RT |     49 ms, 0 RT |      245 ms, 1 RT |      487 ms, 1 RT |

Reading the table:

- idlip loads its resume loader (10.0 kB) and nothing else before `load`. The first click fetches the handler chunk and one binding chunk, two requests in a chain of two round trips. The other frameworks have the code of the page already, or preload it while idle, so their first click costs no request after idle.
- The SSR HTML of idlip is larger because it carries the serialized state and the loader listener (4.6 kB for 3 todos, against 1.2 kB for Marko). The cost per extra todo is close to the others (178 B, 14 B gzip).
- The first click right after `load` takes about 350 ms for idlip, which is the two round trips at 150 ms. This is the case that `spike-chunk-merge` targets.
- Marko ships the page as one 9.1 kB file and needs no request, so it wins the click and the render rate at 3 todos.

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
| `brumate-0.3/` | `brumate` 0.3.0 from npm                                                    |
| `qwik1/`       | `@builder.io/qwik` 1.20.2 with Vite 7.3.7                                   |
| `qwik2/`       | `@qwik.dev/core` 2.0.0-rc.3 with Vite 8.3.4                                 |
| `marko/`       | `marko` 6.4.6 and `@marko/vite` 6.1.13, Vite 8                              |
| `harness/`     | The scripts, with `playwright-core` 1.64.1                                  |

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
2. Build the same page as the other folders. Keep the markup the harness looks for: the counter `<button>` comes right after an `<h2>`, the todo items are `ul li button`, the done class is `done`, and the form has one `input` and one `button`.
3. Add `adapter.js`. It exports a `label` and an async `load()` that returns `{ staticDir, render }`. `staticDir` is the folder with the client files. `render(n)` returns the full HTML of the page with `n` todos.
4. Run `pnpm install`, then `pnpm -C benchmarks/harness bench --only <folder>`.

The harness finds every folder with an `adapter.js`, so no registration is needed.
