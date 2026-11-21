# Outcome: errors-client

## Built

- `packages/idlip/src/client/errors.ts`: the region runtime. `findRegion` walks up to the nearest `e<id>:<0|1>` marker, `swapRegion` replaces a region through the block hooks (so sources and children inside stop, and the node index resets), `failRegion` swaps a region to its catch view, `resetRegion` renders it again, `fireError` dispatches `idlip:error`. A region is `{ id, start, state: 'body' | 'catch' }`, read from the marker.
- `HAS_ERRORS` in `src/client/features.ts`, `ERRORS` in `src/vite/features.ts` (on when `manifest.fallback` exists).
- `patch/patch.ts` and `list/index.ts`: a binding that throws calls `failRegion`. With no region around it, the error is rethrown as before.
- `loader/resume.ts`: `load` retries a failed chunk once; `$reset` goes through the queue with a keep-model update and renders the region in `runBatch`; `idlip:error` fires for a failed handler, chunk and patch.
- The `try=<id>` chunk now also exports `region(scope)` (`emitTryChunk`), for reset. Goldens in `test/fixtures/try/expected/client/` rewritten.
- Tests: `test/client/errors/errors.test.ts` (real loader and patcher through `idlip/testing`, rows, handler, chunk retry), `flag.test.ts`.
- Change request: `contracts/compiled-format-errors-client.change-request.md`.

## Proof

Loader gzip -9, todo build (the e2e measure: loader file plus static imports, one file):

- base (`batch/core` e185427): 3919 B.
- branch, flag off (the todo build): 3919 B (+0 B, the budget was 15 B).
- branch, `HAS_ERRORS` and `HAS_RETRY` forced on in the todo build: 4525 B (+606 B). `HAS_RETRY` alone is about 16 B of it. Cut from +826 B by reading rows in the chunk (`getRows$` helper) and emitting `region` only for catch views that use `reset`.

## Deviations

- Edited outside owned and shared paths: `src/compiler/view/codegen/chunks.ts` (`region` export; `reset` has no other way to render the body) and `src/client/list/index.ts` (`patchRow` guard for a row binding).
- `idlip:error` is behind `HAS_ERRORS` and the chunk retry behind its own `HAS_RETRY` flag (detector: on with `fallback` for now). `deploy-skew` can turn `HAS_RETRY` on for apps without `<Try>`. A failed chunk is reported with both off.
- `idlip/testing`: `settled()` rethrows an error that a region caught (`idlip:error`) unless `mount` gets `expectCaught: true`.
- `try=<id>` chunks export `region(scope, start)` only when the catch view uses `reset`; a region in a row reads its rows with the copied helper `getRows$` (`core/helpers.ts`) and a `lists$` path table. `codegen/index.ts` got `getListPath`.
- `findRegion` stops at a child's `n:` boundary (unit test in `boundary.test.ts`).
- A swapped binding error does not call `report`, so there is no `console.error` and `idlip/testing` `settled()` does not throw. It fires `idlip:error`.
- Flag-on cost is 606 B, still above the 300 to 500 B expected.

## Stubs left

- None.

## Gotchas

- `reset` inside a row needs a list path: a helper-call `each` has none, and the reset reports an error.
- A catch view in `<svg>` or `<math>` is parsed with the `namespace` export of its `try=<id>` chunk.
- `$reset` runs after the earlier events of its batch and renders from `unit.model`; the batch patch then runs on the new nodes.

## Proposed learnings

- A new chunk export for a loader feature needs the golden fixtures rewritten (`UPDATE_TRY=1`) | goldens compare the whole chunk | packages/idlip/test/fixtures | yes

## Verification

- `pnpm --filter idlip test`: 643 passed (after rebase onto batch/core).
- `pnpm build && E2E_PORT=7373 E2E_COUNTERS_PORT=7374 E2E_SUBS_PORT=7375 E2E_HOT_PORT=7376 pnpm --filter e2e test`: 16 passed.
- `pnpm typecheck`, `pnpm format:check`, `pnpm lint` (no errors): clean.

## Size

- Estimated M, actual M.
