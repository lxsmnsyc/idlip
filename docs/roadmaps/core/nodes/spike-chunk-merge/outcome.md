# Outcome: spike-chunk-merge

## Built

- `benchmarks/idlip-merge/run.mjs`: builds `benchmarks/idlip` with a local inline Vite config into `benchmarks/idlip-merge/dist`, serves three variants of the page and measures the first click on a throttled network (150 ms latency, about 1.6 Mbit/s, the harness settings). It writes `dist/results.json` (or `dist/results-gzip.json`) and prints the table and the waterfalls of the first round.
- Variants:
  - `split`: the current build. 11 chunks for the module.
  - `merged`: every chunk of the module bundled into one file, as brumate's `merge` does. The HTML points every chunk id at that file.
  - `parallel`: the current split, plus an inline script that starts the handler chunk and the binding chunks of its write set in the same tick as the click, which is what `write-sets` will make the loader do. The write sets are written by hand (`WRITES` in `run.mjs`).
- Run it with `node benchmarks/idlip-merge/run.mjs [--rounds 20] [--gzip] [--no-build]`. It needs `pnpm --filter idlip build` first.

## Result

- result: merging is about 150 ms faster than the current split on the first click, because it removes one round trip. Parallel loading removes the same round trip. Merged and parallel are within 10 ms of each other, and which one is ahead depends on compression. After `write-sets`, merging does not make the first click faster.
- Recommendation: rely on parallel loading. Keep the split and add no merge threshold now. Revisit a threshold only as a bytes optimization for pages where users click several handlers (see Bytes).

### First click, ms from click to updated DOM

Run 1: 20 rounds, JS served uncompressed as in the harness. Load average 3.87 at the start, 7.50 at the end, 4.0 to 7.5 across rounds. Median, p25 to p75, min to max.

| Click   | Mode | split                 | merged                | parallel              |
| ------- | ---- | --------------------- | --------------------- | --------------------- |
| counter | cold | 371 (359-374) 344-379 | 222 (219-224) 211-270 | 212 (208-217) 203-222 |
| toggle  | cold | 366 (364-372) 352-397 | 219 (213-225) 203-338 | 212 (205-219) 201-231 |
| counter | idle | 370 (364-377) 353-394 | 221 (216-227) 212-247 | 212 (206-215) 196-241 |
| toggle  | idle | 370 (359-376) 354-389 | 220 (213-223) 203-230 | 215 (211-219) 197-251 |

Run 2: 15 rounds, JS served with gzip -9 (`--gzip`). Load average 7.27 to 10.24 across rounds, 5.54 at the end.

| Click   | Mode | split                 | merged                | parallel              |
| ------- | ---- | --------------------- | --------------------- | --------------------- |
| counter | cold | 369 (361-378) 356-404 | 205 (198-210) 195-221 | 215 (208-218) 204-297 |
| toggle  | cold | 364 (358-370) 352-426 | 209 (201-211) 195-216 | 212 (211-217) 201-240 |
| counter | idle | 363 (357-370) 352-386 | 203 (197-206) 189-283 | 213 (209-218) 204-285 |
| toggle  | idle | 362 (358-364) 345-374 | 206 (199-217) 196-297 | 213 (207-219) 204-302 |

Beyond the noise (Mann-Whitney U, two-sided):

- split against merged or parallel: 147 to 164 ms in every case, p below 1e-5. In every case the max of merged and of parallel is below the min of split.
- merged against parallel: uncompressed, parallel is 5 to 10 ms faster (p 1.6e-5 to 0.23). With gzip, merged is 3 to 10 ms faster (p 0.0013 to 0.093). The sign flips with how the bytes travel, and the gap is under 5% of the click, below the 20% that the benchmarks node reads as equal under load.

### Waterfalls (cold counter click, first round, ms after the click)

split (2 requests, 2 round trips):

```
  62-220  app.handler.increment.js     79 B
 221-377  app.binding.count.js        394 B
```

merged (1 request, 1 round trip):

```
  42-215  app.merged.js              3521 B
```

parallel (2 requests, 1 round trip):

```
  45-200  app.handler.increment.js     79 B
  45-207  app.binding.count.js        394 B
```

The toggle click has the same shape: `app.handler.toggle.js` (118 B) then `app.binding.todos._.done.js` (879 B) for split, both at once for parallel, the one merged file for merged. No click loads the list chunk.

### Bytes

| Variant  |                                                         Module JS in the build | First counter click |        First toggle |            After counter, toggle and add |
| -------- | -----------------------------------------------------------------------------: | ------------------: | ------------------: | ---------------------------------------: |
| split    |                                    11 files, 4,579 B / 2,938 B gzip (per file) |       473 B / 351 B |       997 B / 613 B | about 4.0 kB / 2.5 kB (benchmarks table) |
| merged   |                                                 1 file, 3,521 B / 1,144 B gzip |   3,521 B / 1,144 B | 0 B after the first |                        3,521 B / 1,144 B |
| parallel | as split, plus 667 B / 377 B of inline script in the HTML (only for the spike) |       473 B / 351 B |       997 B / 613 B |                                 as split |

- The merged file is smaller than the sum of the chunks because each chunk repeats the same helpers (text conversion, the text setter, the HTML escapers). Gzip per file makes the gap larger: 1,144 B against 2,938 B.
- Brumate's rule compares the sum of the minified parts with 4096 (`DEFAULT_MERGE`). That sum is 4,579 B here, so brumate's rule would keep this module split. Measured on the bundled output (3,521 B) it would merge. A threshold in idlip has to pick which of the two it counts.

### Reproduce

- Commit `1b944cf` (`batch/core`) plus this node's `run.mjs`. `pnpm install --frozen-lockfile`, `pnpm --filter idlip build`, then `node benchmarks/idlip-merge/run.mjs --rounds 20` and `node benchmarks/idlip-merge/run.mjs --rounds 15 --no-build --gzip`.
- Apple M2, 8 GB, Node 26.12.1, the Chrome the harness finds, headless. The machine was shared with other agents during both runs.

## Deviations

- The brief asked for two waterfalls. The orchestrator's prompt added the `parallel` variant, so there are three.
- `benchmarks/idlip-merge` has no copy of the app source and no `package.json`. A new workspace package changes `pnpm-lock.yaml`, which this node does not own. `run.mjs` builds `benchmarks/idlip` with its own inline config and writes to its own `dist`.
- The variants are made after the build (a Vite bundle of the chunks, and HTML rewrites), not by the idlip plugin. No package change.
- A second run serves the JS with gzip, which the harness does not do, because uncompressed transfer charges the merged file for 3.5 kB it would not send on a real server.

## Stubs left

- `WRITES` in `run.mjs` is the hand-written write set of each handler. `write-sets` computes it in the compiler.

## Gotchas

- When a chunk holds more than its group's bindings, the patch runs all of them: `loadBindings` in `packages/idlip/src/client/patch/patch.ts` keeps every function export of a loaded chunk. In the merged variant every click runs every binding of the module, `l1` included. The checks still pass, but a real merge would need the patch to keep only `manifest.groups[key].bindings`.
- `/(\d+) left/` over `document.body.textContent` reads "32" on this page, because the last todo title runs into the count. Read `ul + p` instead.
- In the gzip run the second parallel request finishes about 10 ms after the first. The requests are HTTP/1.1 on localhost, so the second probably opens a second connection. Under HTTP/2 the gap may close. Not measured.
- The click-to-request delay is about 40 to 60 ms in every variant (listener, loader queue, `import()`), before any network time.

## Proposed learnings

- None.

## Verification

- `node benchmarks/idlip-merge/run.mjs --rounds 20`: all 240 runs pass their DOM checks, no page errors.
- `node benchmarks/idlip-merge/run.mjs --rounds 15 --no-build --gzip`: all 180 runs pass, no page errors.
- `pnpm format`: done before the commit.

## Size

- Estimated S, actual S.
