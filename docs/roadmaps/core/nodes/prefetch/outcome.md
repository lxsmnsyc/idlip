# Outcome: prefetch

## Built

- `Manifest.listens` (`src/core/format.ts`, `src/compiler/view/codegen/plan.ts` and `index.ts`): event type to the handler names the view dispatches on it. The goldens of counter, todo, effects and nested gain one `listens` entry each, and nothing else.
- `packages/idlip/src/server/preload.ts`: `renderPreload(chunks, manifest | manifests, { events, max, format, nonce, crossorigin })`, exported from `idlip/server`. It reads manifests only, not markup. For each event (in the given order), manifest and handler name (sorted) it names the handler chunk, then the binding chunks of its `bindings`, until `max` (default 8). For the todo page it names `toggle` and `binding=todos.*.done`. `format: 'header'` returns a `Link` value for 103 Early Hints, which can go out before the page renders.
- `packages/idlip/test/server/preload.test.ts`: the todo manifest names only those two chunks, the events option, the header format, the cap and its order, child manifests, the nonce and escaping, crossorigin, no `listens`, an unknown handler.
- `benchmarks/prefetch/run.mjs`: interleaves rounds of the `benchmarks/idlip` page with and without the links on one Chrome, 150 ms latency, click right at `load`. Run `node benchmarks/prefetch/run.mjs --rounds 30`. It writes `dist/results.json`.
- Change request: `contracts/core-api-preload.change-request.md` (the manifest field and the export).
- Default: off. The function is opt-in and `examples/todo` does not call it (see Deviations). The loader and listener code are unchanged: 0 B.

## How to turn it on

1. Import `renderPreload` from `idlip/server`.
2. Get the `chunks` and `manifest` that the built server module exports (`export const manifest`, `export const chunks`), and for a page with children the manifests of the child modules too (`PageState.modules`).
3. Put `renderPreload(chunks, manifests)` in `<head>` before the loader script, or send `renderPreload(chunks, manifests, { format: 'header' })` as a `Link` header, in a 103 response when the server supports it. Pass `nonce` under a nonce policy and `crossorigin` for chunks on another origin.
4. Request counts: the two chunks of the first click (`handler` and the binding chunks of its write set) load with the page instead of at the click, so the first click makes 0 requests. The page loads 2 more requests than before, and the e2e test "only the page and the loader load before the first event" must expect them.

## Proof

Command: `node benchmarks/prefetch/run.mjs --rounds 30 --no-build`, twice. Median, p25 to p75, min to max, in ms. Apple M2, 8 cores, 150 ms latency. The machine was busy: load average 8.1 and 9.8 at the start, 7.8 to 17.3 across the rounds.

- base (links off), click to updated DOM: 221 (211-226) 203-262, and 219 (212-225) 204-260. 2 requests at the click (`handler.increment`, `binding.count`), 1 RT. This matches the 209 to 225 ms of `write-sets`. The harness itself (`pnpm -C benchmarks/harness bench --scenario todos --only idlip --metrics waterfall`, cold, 5 runs at load 14 to 19): 224, 225, 221, 223, 302 ms.
- branch (links on), click to updated DOM: 54 (49-66) 45-99, and 62 (54-68) 50-154. 0 requests at the click, since the browser reuses the preload.
- The gain is about 160 ms. The slowest branch round (154) is below the fastest base round (203), so it is far beyond the noise.
- Cost: the load event waits for the preloads, 410 ms (404-417) against 390 ms (387-398), about 20 ms later. From the start of the navigation to the updated DOM: 612 (599-617) base against 470 (460-478) branch, and 612 (600-620) against 471 (460-488). A user who clicks right at load gets the update 140 ms sooner.
- Loader, todo build, gzip -9 as the e2e test measures it: 3881 B (budget 4096 B) after the rebase onto `batch/core`. The branch does not touch it.
- The preloads fetch the click chunks on every load, also for visitors who never click. On the todo page that is 2 chunks, under 1 kB gzip.

## Deviations

- Not wired in `examples/todo/src/entry-server.ts`: an app cannot reach `manifest` and `chunks` of its compiled module with types, since the type of `*.idlip.tsx` has no such exports. The e2e test "only the page and the loader load before the first event" would also fail with the links on. The benchmark reads both from the state script of the rendered page. The app wiring (a typed export of `manifest` and `chunks`, and the e2e expectation) is for the orchestrator.
- The compiler and the manifest changed (`listens`), outside the owned paths, after the review of the first version, which parsed the markup. The markup parse missed child modules, rows and `<Try>` regions and could not run before the render. `renderPreload` takes the chunk map first, as the brief says, and the manifests second.
- The numbers come from `benchmarks/prefetch/run.mjs` (interleaved rounds, the same measurement as the harness plus the navigation total), because the harness takes one waterfall sample per run. `benchmarks/idlip` is unchanged.
- `render.ts` is unchanged. Not needed.

## Stubs left

- None.

## Gotchas

- Pass the child manifests too, or their handlers are not named. A handler a child dispatches through a message prop is named through the parent's manifest.
- When `max` cuts the list, the earliest event, manifest and handler name win.
- Preloads delay the load event by about 20 ms.
- With a CSP that uses a script nonce, pass `nonce`.

## Proposed learnings

- Measure a cold click with interleaved rounds | load on a shared machine drifts between runs | benchmarks | no

## Verification

- `pnpm --filter idlip test`: 573 passed.
- Benchmark rerun on the rebuilt code, 20 rounds, load 6.7 to 9.2: base 221 (216-225) 203-233, branch 60 (51-66) 46-112, 0 requests at the click.
- `pnpm build && pnpm --filter e2e test`: 14 passed.
- `pnpm typecheck` and `pnpm format:check`: clean. `pnpm lint`: no errors in the new files.

## Size

- Estimated M, actual M.
