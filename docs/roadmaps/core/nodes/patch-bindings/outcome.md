# Outcome: patch-bindings

## Built

All in `packages/idlip/src/client/patch/`, exported from `index.ts`:

- `diff.ts`: `diffPaths` (reference comparison along each path, `*` pairs by index and under a keyed list also by key) and `getListKeys(manifest)`.
- `patch.ts`: `createPatch(patchList): Patch`. `patch(page, prev, next)` diffs the manifest paths (skipping `props`), walks `groups` in order with the covers rule, loads the chunks of the changed groups in parallel, deduplicates bindings by export name, then runs `a`, `t` and `c` bindings outside rows and calls `patchList` for each `l` binding outside rows, in id order. Row bindings go to `patchList` in `ListContext.bindings`, with those of nested lists included. `findNode(root, name)` looks nodes up.
- `dom.ts`: `setText`, `setAttr`, `setOn`, `setBranch` and `parseHtml` (Trusted Types policy `idlip`, `<svg>` and `<math>` wrappers).
- `blocks.ts`: `onBlock(add, remove)`, `addBlock`, `removeBlock` and `findInnerBlocks`. `setBranch` calls them. `patch()` never awaits what a hook starts.
- Lazy lookup: nothing runs at resume. The first binding lookup of a patch walks the page once and builds a map of nodes outside rows (rows are skipped by their `<!--i-->` markers). `setBranch` clears the map after a swap. Lookup time on the todo fixture in happy-dom: 0.05 ms for the first lookup.

Row bindings (compiled-format v9): a chunk that holds a row binding of list L also exports L's `l`. `patch()` runs every `l` a loaded chunk exports, so `patchList` is called with the chosen row bindings in `ListContext.bindings` even when only outside state changed (`class={selected === t.id}`). Test: a hand-built chunk with `a2` and `l1` where only `selected` changes loads one chunk and calls `patchList` once.

Shared helpers for `patch-lists` (`src/client/patch/index.ts`): `onBlock(add: (start: Comment) => void, remove: (start: Comment) => void): void`, `addBlock(start: Comment): void`, `removeBlock(start: Comment): void`, `findInnerBlocks(start: Node, end: Node | null): Comment[]` (children first), `parseHtml(doc: Document, html: string, ns?: 'svg' | 'mathml'): Node[]` (Trusted Types policy `idlip` is created inside), `findNode(root, name)`.

Hook order: `setBranch` calls remove hooks for the blocks in the old content (children first), then the block, before the swap. It calls add hooks for the blocks in the new content (children first), then the block, after it.

Acceptance: all four items hold. Changing `draft` loads only `binding=draft`. The property test compares `diffPaths` with an oracle on random model pairs, including keyed nested lists. The hook test checks the order and that `patch()` resolves while hooks start promises that never settle. The fast check passes.

## Deviations

- `patch()` is `createPatch(patchList)`, not a bare function, because `patch-lists` has not landed. The integrator calls `createPatch(patchList)` once.
- `setText`, `setAttr`, `setOn` and `setBranch` live here, since the brief patches text, attributes, classes and conditions. `src/client/index.ts` is not mine, so none of this is exported from `idlip/client` yet. The integrator re-exports `./patch/index.ts`.

## Stubs left

- `patchList` is a `vi.fn` in the tests. `patch-lists` implements it and calls `addBlock` and `removeBlock` for rows' blocks.
- The client render helpers `text`, `attr` and `on` are not here.

## Gotchas

- Size: `patch/index.ts` bundled and minified is 5.3 kB, 2.21 kB gzip. That is over half of the 4096 B budget for the loader, lists, helpers and `idlip/client` together. If the budget gets tight, move `parseHtml` to a shared module with `patch-lists`, and drop what a build does not use (`setBranch` without conditions).
- Chunk files import `idlip/client`, so the integrator must export the helpers there. The tests mock it with `dom.ts`.
- Only `setBranch` clears the node map. A `patchList` that adds or removes blocks outside rows must call `clearNodes()` from `nodes.ts`, or nothing changes for rows, since rows are not indexed.

## Proposed learnings

- Test a path diff against an oracle that lists the value pairs a path compares | the oracle has a different shape from the walker, and turning off the key pass fails the test | packages/idlip/test/client | yes, by the property test

## Verification

- `pnpm --filter idlip exec vitest run test/client/patch`: 14 passed (5 in `diff.test.ts` with a 1000-run fast-check property over keyed, unkeyed, record and non-list paths, 9 in `patch.test.ts`).
- `pnpm --filter idlip test`: 225 passed.
- `pnpm typecheck`, `pnpm format:check`: pass.
- `./node_modules/.bin/oxlint --type-aware`: no errors. One new warning in `dom.ts` (`no-base-to-string`), since the contract renders other values with `String`.

## Size

- Estimated M, actual M.
