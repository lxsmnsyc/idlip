# Change request: view-ir v6 to v7

- From node: spike-view-analysis
- Status: open

## Problem

The brief asks `spike-view-analysis` to freeze `contracts/view-ir.md`, and the roadmap rules forbid a worker to edit contracts. The v6 draft leaves the interface "to be decided", and the prototype found facts it does not cover:

- Holes in a child component read its props, so a path can start at `props` as well as at a state field. "Model paths start at a state field name" is too narrow.
- Computed access (`byId[selected]`) needs an expression segment that keeps the key, and a path set form (`byId.*` plus `selected`).
- `<For>` over a helper call (`visible(items, query)`) has no item path. Item reads must fall back to the paths of `each`.
- `<Subscribe on:value={tick}>` passes the yielded value, while `on:click={add}` passes nothing (0002). The event needs to record the difference.
- `<Try>` gives `reset` as an event target, and a child can forward `props.onRemove`. v6 names only handlers.
- No construct in the closed grammar needed `dynamic`. Aliases resolve, because `const` is inlined.
- Element nestings the HTML parser rewrites need rule ids, including the implied `<tbody>` that brumate allows.
- Coordinator decisions from the review: pure globals and a fixed list of non-mutating methods are allowed in holes, and the production analysis follows imported components (`component-import` for an import that is not an `.idlip.tsx` component).

Evidence: `nodes/spike-view-analysis/prototype/out/*.txt`, produced by `node prototype/run.ts`.

## Proposed change

Replace `contracts/view-ir.md` with `nodes/spike-view-analysis/view-ir.proposed.md` (v7, `status: frozen`). It keeps every v6 decision and adds the types, the path rules above and the rule id list.

## Affected nodes

`compiled-format` (reads path sets and events), `compile-view-analyze` (produces the IR), `compile-view-codegen` and `compile-update` (consume it), `dynamic-paths` (may be unneeded), `keyed-paths` (uses the reserved `keyed` segment), `jsx-types` (event modifier syntax fills the reserved `modifiers`), `form-fields` (fills the reserved `form` root), `core-api` (its `For` type must keep the child `(item, index?) => view`).

## Workaround in place

None needed: the spike builds no shipped code. The prototype's types are in `nodes/spike-view-analysis/prototype/ir.ts`.

## Decision

<Filled in by the orchestrator.>
