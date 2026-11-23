# Log: bench-brumate-latest

- Start: reset to batch/core f5ec645. Load 3.96 3.96 4.52 at the start (8 cores).
- Bug proof on base: `loadApp('idlip').render(3)` with tags stripped and `/(\d+) left/` gives "32", expected 2. `bench --only idlip` still passes on base since 32 - 1 = 31 matches the toggled page by accident.
- npm view brumate version: 0.8.1. Copied brumate's `src/` and its latest `server.ts` (takes `bundles`) and wrote an adapter for the `{ all, bundles }` hints format.
- Fix: `harness/count.mjs`, `browser.mjs` reads `ul + p`; `count.test.mjs` checks it.
- Diffed brumate's harness against this one: no change that moves todos numbers.
- Full run: load 4.92 to 4.13, 181 s. 11-round ssr-speed rerun: load 4.41 to 3.49.
