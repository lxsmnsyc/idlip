# Outcome: perf-ssr-state

## Built

- `packages/idlip/src/server/render.ts`: the manifest, chunk map and child manifests of a root module are serialized once and kept (`getPart`, `buildPart`); each render serializes only model, props, slots and dynamic (`writeState`). Child manifests lose `events`, `listens`, handler `writes` and `view`; the chunk map loses child view URLs (`toClientManifest`, `collectModules`). `mergeState` and its object spreads are gone.
- `test/server/render.test.ts`: two tests for kept data (per-render models, build id, shared values).
- Change request `contracts/compiled-format.v12.change-request.md`.
- `benchmarks/harness/ssr-ab.mjs` and `ssr-ab.sh`: state script bytes, renders/s and profile of the dashboard and todos pages, and the interleaved A/B wrapper. Both numbers in Proof come from them.

## Proof

- base: `batch/core` 9d42687. Node profile, dashboard, 1.624 ms a render: `mergeState` 16.8%, `collectModules` 2.9%, seroval about 45%. Todos (0.048 ms): seroval about 60%. Method in `log.md`.
- branch: same commands, interleaved `bench.py` (load 9 to 16, noise = 3x the larger MAD).

| Metric                                  | base                   | branch                   | noise            |
| --------------------------------------- | ---------------------- | ------------------------ | ---------------- |
| Dashboard SSR renders/s (10 runs)       | 918 (770-984)          | 4,746 (3,550-4,932)      | 3x MAD 400       |
| Todos, 3 todos, SSR renders/s (20 runs) | 33,710 (9,680-43,490)  | 129,100 (76,620-159,500) | 3x MAD 12,500    |
| Dashboard HTML                          | 111,440 B (gzip 9,283) | 100,990 B (gzip 8,447)   | exact            |
| Dashboard state script                  | 75,741 B (gzip 5,642)  | 65,291 B (gzip 4,815)    | exact            |
| Todos HTML and state                    | 5,066 B, 2,410 B       | unchanged                | exact            |
| Todo loader, gzip -9                    | 3,979 B                | 3,979 B                  | no client change |

- Dashboard profile on the branch: 0.255 ms a render.

## Deviations

- Added `benchmarks/harness/ssr-ab.mjs` and `ssr-ab.sh` (shared path). `src/core/format.ts` gains `ChildManifest`; `src/client/nesting.ts` fills `events: []`.
- Edited outside owned paths: `test/fixtures/reference.ts`, `test/fixtures/fixtures.test.ts`, `test/fixtures/nested/board/expected/page.html` (the nested golden follows the new child shape). Change request written.
- Todos bytes did not shrink: its root manifest is a golden and stays whole. Only speed changed there.
- The chunk map keeps its flat keys; re-keying changes every golden and the loader tests (see the change request).

## Stubs left

- None.

## Gotchas

- The kept part is keyed by the root manifest object and checked against `chunks`, `uses` and the children's module data. A child outside `uses` is rebuilt on each render.
- A model that seroval writes as a function (shared values) takes the single-call path.

## Proposed learnings

- Keep what a render repeats out of the seroval call | the manifest and chunk map were 60% of its work and never change | `packages/idlip/src/server` | yes (`kept module data` tests)

## Verification

- `pnpm --filter idlip test`: 661 pass. `pnpm --filter e2e test`: 18 pass. `pnpm lint`, `pnpm format:check`, `pnpm typecheck`: pass.

## Size

- Estimated M, actual M.
