# Log: dom-refs

- Reset to `batch/core`. Nothing of the node existed.
- Added `HAS_REFS` (features.ts, detector in vite/features.ts). The detector looks for `$after` in client chunks.
- Handler rewrite: plain `Dom.x(...)` statements become `$after.push(...)`. Returns become `{ $step: true, model, after }`. `Dom` import is dropped from the chunk.
- `e2e` first failed on port 4173 held by another worktree. Waited and reran.
