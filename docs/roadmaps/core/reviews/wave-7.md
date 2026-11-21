# Wave 7 review

## Landed

- On `batch/core`: `keyed-paths`, `custom-effects`, `run-tasks`, `stock-sources`, `benchmarks`, `runtime-flags`, and `markup-syntax` (contract `markup-grammar` v1).
- On `feat/markup-frontend`: `markup-parser`, `markup-lower`.

## Contracts changed

- `compiled-format` v10: task chunks and `manifest.tasks`, `runTask(host, task)` (`RunTask` removed), keyed chunk file names and `diffPaths` rule, runtime feature flags.
- `view-ir` v10: `list.find(...)` keyed paths, `await-*` rule ids replace `handler-await`.
- `core-api` v10: stock sources and their types; `Random`, `Time` and `until` exported.
- `markup-grammar` v1: no change. Its change request is marked applied; the file exists on `batch/core` and `feat/markup-frontend`, so expect a trivial merge conflict.
- Not applied: `compiled-format-nesting.change-request.md` (under review, on `feat/nesting-format`).

## Plan changes

- Briefs of `write-sets`, `dom-refs`, `commands-subs`, `nesting-runtime`, `global-events`, `keyed-writes`, `errors` and `size-budgets` got an "Updates after wave 7" section: `HAS_*` flags, the new budget meaning, `runTask(host, task)`.
- Nested `CLAUDE.md` added to `src/client`, `src/vite` and `src/sources`. Not added for `src/compiler/markup`, which exists only on `feat/markup-frontend`.

## Learned

- The loader budget of 4096 B is the loader with no optional features. Tasks cost +274 B and keyed paths +124 B.
- Test generated TSX by AST, not text, because formatters change layout.

## Open items

- `markup-parser` and `markup-lower` have no `spent:` value. Calibration shows n/a.
- `nesting-format`, `spike-chunk-merge` and `markup-frontend` are active; their briefs were not touched.
- Token forecast is about 13.6M against 6.7M spent; check `budget:` with the user.
- `size-budgets` should wait for the flags to settle; consider its priority.
- Open markup questions from `markup-syntax` were decided by the orchestrator in the one-shot run; the user may revisit.

## Milestones

- `todo-resumes`: done. `apps`: 22 open, 8 outline, 9 done. `0.1`: 2 open. All should work placed by wave 7.
