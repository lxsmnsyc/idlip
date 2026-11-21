# Outcome: patch-lists

## Built

- `packages/idlip/src/client/list/index.ts`: `patchList(start, prev, next, context)`. It pairs old rows and new items by `key`, loads the item template chunk only when a row is inserted (before any DOM change), removes rows whose key is gone, renders and inserts new rows, and moves kept rows outside the longest increasing run. It runs the chosen row bindings on every kept row, with the old and new row scopes. For a chosen nested `l` it calls itself on the inner start comment of the row, with the entry from `manifest.lists`. It calls the block hooks for blocks in inserted rows and, children first, in removed rows.
- `patchList` uses `onBlock` hooks (`addBlock`, `removeBlock`, `findInnerBlocks`) and `parseHtml(doc, html, ns?)` from `src/client/patch/`, so there is one hook registry and one Trusted Types policy. The temporary seam is deleted.
- `packages/idlip/test/client/list/list.test.ts`: 22 tests. Add, remove, toggle, reorder and reverse on the todo fixture compared with the fixture server module's render, with rows from the fixture's `list.3.js`. A fast-check model test (add, remove, move, toggle, 200 runs of up to 25 commands) compares after every step. Outside state (`selected`) re-runs in every kept row. Three-deep nested lists, a nested `l` detached by a `c` in the same row, SVG rows, a repeated key, block hook order, and template loading only on insert.

## Deviations

- None. The change request I filed is accepted on `batch/core` (v9), and `patchList` follows it: `context.bindings` goes to nested lists unchanged and each list takes the names in its `bindings`.

## Stubs left

- `src/client/index.ts` does not export `patchList` yet. `patch-bindings` or `resume-loader` adds the re-export.
- The test bindings use attribute-only setters, not the real `setAttr`.

## Gotchas

- Rows are found by counting `i` and `/i` markers, so the DOM must match `prev`. A `prev` out of step with the DOM breaks the pairing.
- A key missing from the old list, or repeated, is treated as an insert. Duplicate keys are not supported.
- Block start comments are every start marker but text holes (`t…`) and rows (`i`), so new block kinds such as `<Try>` work if they use their own marker.
- A chosen row binding runs on every kept row, so a patch that changes `todos.*.done` runs `a4` and `a5` on each row. They are cheap and idempotent.

## Proposed learnings

- Chosen row bindings run on every kept row | their paths may include state outside the list | packages/idlip/src/client | yes, the `selected` test

## Verification

- `pnpm --filter idlip exec vitest run test/client/list` (brief's verify): 22 passed.
- `pnpm --filter idlip test`: 272 passed.
- `pnpm format:check`, `pnpm typecheck`: pass. `./node_modules/.bin/oxlint --type-aware`: no findings in the new files.

## Size

- `patchList` adds 1446 B gzip (`gzip -9`, Vite minifier) on top of the patch module: `createPatch(patchList)` is 3036 B, `createPatch` alone 1590 B. That is 35% of the 4096 B loader budget before the loader itself, so `perf-pass` should look at it.
- Estimated M, actual M.
