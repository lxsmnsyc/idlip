# Outcome: nesting-runtime

## Built

- `packages/idlip/src/client/nesting.ts`: `installNesting(seams, patch)`, `addChild`, `setProp`. The slot table is a `Map` per root, made from `state.slots` on first use. Entries are `live` (a `Root`-shaped unit with `path` and `gen`) or `removed` (gen only).
- `resume.ts`: one `Seams` object (`target`, `live`, `patch`) with root-only defaults, and `if (HAS_CHILDREN) installNesting(seams, patch)`. `Pending` has a `unit`. `isStep` tests `$step === true`. A step without `task` is allowed. A continuation is pushed only while its unit is live, with `owner` set to the unit's path.
- `features.ts`: `HAS_CHILDREN`. `vite/features.ts`: `CHILDREN` is on when a manifest has `view` or the server code has `export const uses`.
- `listener.ts`: `owner: m[3]` in the queued event (about 12 B).
- `format.ts`: `Slot`, `PageState.slots` and `modules`, `Manifest.view`, the owner in `DomMessage`, `QueuedEvent.owner`, `Scope.path`, `Page.path` and `start`, `PropBinding`, `ViewChunk`, `Step.$step` and optional `task`.
- Patching: `findNode(root, name, from)` indexes a child between its boundary comments and skips nested ones. The row index of `patchList` skips nested boundaries. `p` bindings run with no node, in `patch` and in `patchRow`. `matchMarker` knows `n:`. `getPlan` keeps `props.*` paths when `HAS_CHILDREN`.
- `index.ts` exports `addChild` and `setProp`.
- Tests: `test/client/nest/` (9 tests on the real loader, the patcher and the nested goldens), and `CHILDREN` detection and drop in `test/vite/features.test.ts`.

Behavior: a click is routed by `event.owner`, else by the boundary around the target. A child update loads only the child's handler and binding chunks. After a patch, the children whose props changed (by value) are patched, parents first. A message for a removed slot, or a task continuation for an old generation, is dropped. A row that returns gets a higher gen and starts from its props.

## Proof

Not a problem-fix node. Loader gzip -9 (loader and static imports):

- todo build (no children): 4023 B, under 4096. The e2e budget test passes. It was 3926 B before this node, so the seams cost 97 B with the flag off.
- With `HAS_CHILDREN` on: about +650 B (library build of `src/client/index.ts`: children off 5311 B, on 5959 B). A nested app's loader is about 4.7 KB. Not capped.

## Deviations

- Code is in `src/client/nesting.ts`, as the orchestrator said, not `src/client/nest/**`.
- Edits outside owned and shared paths: `src/client/loader/listener.ts` (the `owner` copy, as the change request says), `src/client/patch/guards.ts`, `src/client/patch/nodes.ts`, `src/client/list/index.ts` (boundary scoping, `p` bindings), `src/client/features.ts` and `src/vite/features.ts` (the flag recipe), `test/vite/features.test.ts`, and `test/client/tasks/tasks.test.ts` (inline handlers got `$step: true`).
- `seams` has three entries (`target`, `live`, `patch`), not two.
- `Page` gained `path` and `start`. `Root` (exported from `resume.ts`) gained `path`, `gen`, `top` and `shown`.
- `Step.send` (messages from a handler that calls a message prop) is not implemented. The fixtures have no such handler.

## Stubs left

- `Step.send` dispatch.

## Gotchas

- `diffPaths` is unchanged. The child patch passes `{ ...model, props }` as prev and next.
- `addChild` and `setProp` use the root of the running patch. Chunks call them only inside a patch.
- The node index cache is keyed by root and start comment. Tests that reuse `document.body` must clear it with `addBlock`.
- The detector needs `uses` in the server code or `view` in a manifest. `vite-plugin` compiles every module in `buildStart`, so the child's manifest has `view` only if that compile passes `child: true`. The `uses` check covers the parent either way.

## Proposed learnings

- A child component is a `Root`-shaped object, so loader code written for a root runs on a child | one code path for handlers, tasks and patches | packages/idlip/src/client | no

## Verification

- `pnpm --filter idlip exec vitest run test/client/nest`: 9 passed.
- `pnpm --filter idlip test`: 521 passed.
- `pnpm build && pnpm --filter e2e test`: 10 passed.
- `pnpm lint` (no errors), `pnpm typecheck` clean, `pnpm format` run.

## Size

- Estimated M, actual M.
