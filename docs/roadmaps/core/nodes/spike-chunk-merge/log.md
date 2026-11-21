# Log: spike-chunk-merge

- Branch `feat/spike-chunk-merge`, reset to `batch/core` at `1b944cf`.
- The bench app builds 11 chunks for its one module, 4,579 B raw in all. Brumate's rule (`size < merge` over the sum of the minified parts, `DEFAULT_MERGE = 4096`) would not merge it. The merged bundle is 3,521 B raw / 1,144 B gzip, because the chunks repeat the same helpers (`toText`, the text setter, the escapers).
- No package change, so the runner makes the variants after the build. `merged`: Vite bundles every chunk into `app.merged.<hash>.js` with explicit re-exports (first chunk wins a shared name such as `l1`), and the HTML points every chunk id at that file. `parallel`: an inline script before the loader listens on click, input and submit in the capture phase and calls `import()` on the handler chunk and the binding chunks of its write set. The loader's own `import()` of the same URL joins the request in flight.
- The write sets are written by hand in `run.mjs` (`WRITES`), from `src/app.idlip.tsx`.
- No `package.json` in `benchmarks/idlip-merge`: a new workspace package changes `pnpm-lock.yaml`, which this node does not own. `run.mjs` builds `benchmarks/idlip` with an inline config through `createRequire` from that app, and loads `playwright-core` from `harness/`. The folder has no `adapter.js`, so the main harness does not list it.
- The first toggle check used `/(\d+) left/` over `body.textContent`. The last todo's title runs into the count ("Todo number 32 left"), so it read 32. The harness avoids this because it compares with a value read the same way. The runner reads `ul + p` instead.
- A loaded merged chunk makes the patch apply every binding export of the module, since `loadBindings` keeps every function export of a loaded chunk. Handler names and `render` find no node and are skipped. The checks pass with no page errors, but the patch runs all bindings on each click.
- Run 1: 20 rounds, JS served uncompressed as in the harness, load average 3.87 at the start, 7.50 at the end (4.0 to 7.5 per round).
- Run 2: 15 rounds, JS served with gzip -9 (`--gzip`).
