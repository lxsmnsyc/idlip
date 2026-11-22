# Log: preimport-chunks

## 2026-11-22

- Branch `node/preimport-chunks` from `batch/core`, rebased onto 6918353 (`fix-string-length`, `hero-animation`) at the orchestrator's note.
- Baseline todo loader on 6918353, node `zlib.gzipSync` level 9 over the built file from an empty `dist`: 4044 B (the orchestrator quoted 4082 B, likely another gzip measure). Dashboard loader 4880 B.
- Manifest access: the compiled module's `manifest` and `chunks` exports have no types (plain TSX). `render()` learns them from `context.state`, so `renderPage` now returns `chunks` (the state's URLs without `build`) and `manifests` (root, then children) from the cached static part. No compiler change. Cost: Early Hints need one render first; the values are the same for every render of a page.
- Idle import: `client/preimport.ts`, one call site in `resume()` behind `HAS_PREIMPORT`. It reads `link[rel=modulepreload]` after `load` at `requestIdleCallback` (or `setTimeout`) and calls the loader's `load(href)`. Reading the links instead of the state: no decode at idle, fewer bytes, and it also covers the helpers URL.
  - First version with a `document.readyState` check: +108 B on the todo loader. Without it: +86 B. The check is not needed: a loader script in the markup delays `load`.
  - Flag is a plugin option (`preimport`, default off) like `skew`, since no manifest says whether the server writes links.
  - Off: the todo loader file is byte-identical to the base (same hash, 4044 B).
- Wiring: `examples/todo` renders the links by default, `?preload=off` turns them off. e2e loading-path tests go to `/?preload=off`; with scripts off Chromium cancels the module preloads and the problems fixture counts each, so that test uses it too. New e2e test: preloads of `helpers`, `handler=toggle`, `binding=todos.*.done` and a first click with no request, no CSP violation under the nonce policy.
- Bench apps: todos and rows with default `max` (8), dashboard with `max: 20` (the default 8 covered widget 0 and half of widget 1, so the harness click on widget 1 still fetched 2 files). Preimport on via vite config, `IDLIP_PREIMPORT=0` builds without.
- Scale: wired first, then reverted. With 8 links, JS before `load` was 7.5 kB gzip at every size (flat) instead of 5.0 kB, and the clicked widget was still not covered (first click 0.6 kB). The scale page measures startup, so it keeps no links and no preimport: its numbers are unchanged.
- Harness: `first-click-ab.mjs` interleaves the waterfall's idle run between `--side name=<dist>[:off]` builds, warmup run dropped, 3 x MAD noise, load printed, try/finally cleanup. `measureFirstClick` exported from `browser.mjs`. `serve.mjs` passes `?preload=off` to the todos and rows pages.
- Smoke run of the A/B, dashboard, 2 runs (not a measurement): links 73.5 ms, preimport 67.5 ms, off 245.5 ms.
- Load average 4 to 9 during the work. Benchmarks wait in `run-all.sh` for a 1-minute load under 3.
- Run 1 of the A/B (harness metric only; load 2.2 to 4.8): preimport within noise, trending slower than links on both pages. Added page-clock metrics (click event to first DOM change, and to the frame after it) and ran again with N = 21 at load 2.24: write 15.9 to 2.9 ms (todos) and 17.6 to 4.6 ms (dashboard), real; frame and harness number within noise. Both runs are in the outcome.
- prefetch run.mjs, 20 rounds at load 2.6 to 2.8: off 227 ms, on 60 ms.
- Mutation check: without the `startPreimport` call the new loader test fails.
