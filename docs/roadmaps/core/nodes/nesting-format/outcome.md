# Outcome: nesting-format

## Built

- `docs/roadmaps/core/contracts/compiled-format-nesting.change-request.md`: compiled-format v9 to v10. It names each section it changes (Interface, DOM encoding, State script, Manifest, Server module, Patching, Reserved) and holds the whole design. `nesting-compile` and `nesting-runtime` follow it. The orchestrator folds it into the contract.
- Golden fixtures in `packages/idlip/test/fixtures/nested/`:
  - `counter/`: a stateful child with a props value (`label`), a message prop (`onRemove`) and state (`count`). Has a `view` chunk (`init`, `render`) for a client-added child.
  - `board/`: a parent with a position child (`Spare`, slot `0`) and a keyed `<For>` of children (slots `1:a1`, `1:a2`). Has `uses`, `p` bindings and an item template that calls `addChild`.
- Shared test files, edited as the brief allows: `fixtures.test.ts` (the two fixtures run through every existing check, plus nested checks) and `reference.ts` (`slot`, `addChild`, `createContext` with paths and `uses`).

The format in short:

- Child state is one flat table, `PageState.slots`: model path to `{ module, model, props }`. `PageState.modules` has the manifests of the child modules and of what they can render.
- Boundary marker `<!--n:<path>-->…<!--/n-->`. Path: one slot per level joined by `/`. Slot: the site index (source order among child nodes), then `:<key>` for each enclosing loop key and an explicit `key`, escaped so a part has no `/`, `:`, `-` or `>`. No key outside a loop means position alone.
- A child's own handlers have no path in the DOM. The loader reads the path from the boundary around the event target. A message prop is `['remove', ['a1'], '', '']`: item 3 is the owner's absolute path, copied by the listener into `QueuedEvent.owner`.
- Props binding `p<id>(scope)` has no node. It calls `setProp(path, name, value)`. A parent's patch then patches each child whose props changed. `diffPaths` reads `props.x` from `{ ...model, props }`.
- A client-added child: the parent's template chunk imports the child's `view` chunk and calls `addChild(path, module, view, props)`. The `view` chunk exists only when a project module renders the module as a child (`compile(..., { child: true })`), so the counter and todo goldens stay as they are.
- Server: `Component(props, context, model, path)`, `context.state(state, path)`, `export const uses = [Child]`, helper `slot`. `ssr-render` merges slots, manifests, chunk URLs and the union of event types.
- Loader: all nesting code in `src/client/nesting.ts` (`installNesting`, `addChild`, `setProp`) behind one call site, for `runtime-flags`.

## Deviations

- The format types (`Slot`, `ComponentState`, `NestedContext`, `ViewChunk`, `PropBinding`) are in the change request and in `reference.ts`, not in `src/core/format.ts`. The brief owns no source files, and contracts are not edited.
- `fixtures.test.ts` and `reference.ts` are shared files. The edits are additive, except that `createContext` now returns `NestedContext` and the root state call may have path `''` or none.
- The nested `server.js` imports `../../counter/counter.idlip.tsx`: the source's `../counter/…` plus one `../` for the `expected` folder. The test mocks it to the child's expected server module.

## Stubs left

- No runtime or compiler code. `nesting-compile` replaces the golden files with compiler output. `nesting-runtime` replaces the reference `addChild`, `slot` and `createContext` merge with the real ones.

## Gotchas

- Binding ids restart in each module, so `t0` and `i-a="2"` occur in a parent and in each child. Lookups must stop at nested boundaries. A global `querySelector('[i-a~="2"]')` finds the wrong node.
- `matchMarker` (`[tcl]\d+`) and `findInnerBlocks` must recognize `n:`, or removing a row never drops its slots.
- A prop hole takes a hole id even for a literal (`label="Spare"` is hole 1). It exports nothing when its path set is empty.
- `manifest.events` of a parent can be empty while its children listen to `click`. The state record's event list is the union, written by `ssr-render`. The listener attaches only what the record lists.
- The listener budget: copying `owner` adds about 15 B against 50 B of headroom, not measured. `resume-loader` or `size-budgets` must confirm.
- `Step.task` becomes optional and `Step.send` is new. `Step` gets an explicit `$step: true` discriminant (state fields starting with `$` are reserved), so `nesting-runtime` must replace the `'task' in result` check in `resume.ts`, and `compile-update` and the `effects` goldens must emit `$step`.
- Slot lifecycle is one union, `SlotEntry = live | removed`, with a generation. Only the block hooks set it. Messages and task continuations for a non-live slot or an old generation are dropped.
- A keyed reorder keeps slots (paths hold keys). The boundary walk is O(n) per click. Message-prop arrays are new each run, so `setProp` compares by value.
- An empty item 2 in a `DomMessage` (`''`) means no modifiers. The listener must not treat `''` as a modifier name.
- The loader budget is 4061 of 4096 B gzip. Nothing in this node touches it, but `nesting-runtime` must keep every new loader export behind `installNesting`, and chunks may import from `idlip/client` only `addChild` and `setProp` besides what is there.

## Decisions for the gate

- A child's model slot is dropped when its block is removed, and restarts from props when the block returns. The change request, Patching, "Removing". Alternative: keep removed slots, which costs state-script size and needs a rule to expire them.
- `key` on a stateful child is optional: position is the default, and inside a `<For>` the loop key always counts.
- Also worth a look: child state lives in a flat table and not in the parent's model, so a parent handler cannot read a child's state. The message-prop owner is an absolute path in item 3 of the DOM message.

## Proposed learnings

- A component's binding ids are local to its module, so any DOM lookup by id must be bounded by the component's boundary | nested components repeat `t0` and `i-a="2"` | packages/idlip/src/client | no
- A chunk may import from `idlip/client` only what the loader holds, and nesting adds exactly `addChild` and `setProp` | the first click must not cost a third request | packages/idlip/src/compiler | yes

## Verification

- `pnpm --filter idlip exec vitest run test/fixtures`: all fixture tests passed.
- `pnpm --filter idlip test`: 22 files, 479 tests passed.
- `pnpm --filter idlip typecheck`: passes. `pnpm typecheck` fails only in `examples/todo`, which needs a built `idlip` that this worktree does not have.
- `oxlint --type-aware packages/idlip/test/fixtures`: clean. `pnpm format` run.
- plain-writing checker on the change request: long-sentence warnings only.

## Size

- Estimated M, actual M.
