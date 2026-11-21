# Outcome: benchmarks

## Built

- `benchmarks/harness`: brumate's harness cut to the todos scenario. `pnpm -C benchmarks/harness bench` builds every app, measures it and writes `benchmarks/results/<timestamp>.{json,md}` (ignored by version control). `idlip` is the first column.
- Apps: `benchmarks/idlip` (new, `src/app.idlip.tsx`, `src/entry-server.ts`, `adapter.js`), `brumate-0.3` (brumate 0.3.0 from npm), `marko`, `qwik1`, `qwik2`.
- `benchmarks/README.md` has the numbers with commit `fd94156` and the machine, the load, how to run it and how to add a framework.
- `pnpm-workspace.yaml` lists `benchmarks/*` and sets `allowBuilds: esbuild: false`. The root `build` and `test` scripts filter to `packages/*` and `examples/*`; no benchmark app has a `typecheck` script; oxlint already ignored `benchmarks/**`.

Headline (busy machine, 5 rounds, 3 todos): JS before `load` 10.0 kB / 4.0 kB for idlip against 9.1 kB / 4.4 kB for Marko, 26.4 kB for brumate 0.3.0, 53.4 kB for Qwik 1 and 97.2 kB for Qwik 2. The first click fetches 2 chunks (1.5 kB raw) in 2 round trips: 354 ms cold at 150 ms RTT, against 49 ms for Marko, 190 ms for brumate, 245 ms for Qwik 1 and 487 ms for Qwik 2. SSR renders per second at 3 todos: 61,286 for idlip, 140,031 for Marko. SSR HTML is 4.6 kB for idlip against 1.2 kB for Marko.

## Deviations

- Brumate's local `brumate/` app is not ported, since this repo has no brumate package. `brumate-0.3` is the npm one.
- The idlip app has no CSP or nonce, as the other apps have none.

## Stubs left

- None.

## Gotchas

- The idlip app needs `pnpm --filter idlip build` first; `bench` does it unless `--no-build`.
- Timings move by about 20% with load. Other agents ran during the run.
- `harness/run.mjs` still has the scenario plumbing (`SCENARIOS = ['todos']`) to ease adding scenarios.

## Proposed learnings

- None.

## Verification

- `pnpm -C benchmarks/harness bench --scenario todos --only idlip,marko,qwik2 --rounds 1`: prints the table.
- Full `bench --scenario todos`: 5 frameworks, 148 s.
- `pnpm --filter idlip test`, `pnpm build`, `pnpm typecheck`, `pnpm format:check`: pass.

## Size

- Estimated M, actual M.

## Deferred

The merge-threshold comparison (brief Goal, second bullet) is not in this node. It moved to `spike-chunk-merge`, which measures it with this harness.
