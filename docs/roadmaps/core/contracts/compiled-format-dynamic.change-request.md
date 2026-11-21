# Change request: compiled-format dynamic holes

- From node: dynamic-paths
- Status: applied on 2026-11-21 by the curator, from the code on `batch/core`

## Problem

compiled-format reserves a `dynamic` field in `PageState` and gives dynamic holes no chunk, group or record.

## Proposed change

1. Manifest: one group with the key `$dynamic`, `paths: []`, `chunk: 'binding=$dynamic'`, `bindings` the dynamic holes (`t0`, `a1`), `covers: []`. It is last in `groups`. Only top-level holes of a root component are in it. It exists only when the module has a dynamic hole. The chunk exports every dynamic binding, which take `(node, { model, dynamic })`.
2. `PageState.dynamic?: Record<string, string[]>`: binding name to the model paths the hole read on its last run, in manifest form (`todos.*.done`, `todos.length`, array indexes as `*`, no keyed segments). The server fills it while it renders and `render()` writes it in the state script. It is absent when the module has no dynamic hole.
3. `Page.dynamic` and `Scope.dynamic` hold the same object on the client, for the root only. A child has none, so a child module cannot have a dynamic hole.
4. Each run of a dynamic binding replaces its entry (`track$(dynamic, name, model, read)`, copied into the chunk). After a patch, the loader's diff reads the new entries.
5. Patch: the loader selects `$dynamic` when `diffPaths` over the recorded paths of any hole reports a change, and runs only the holes whose paths changed. Every handler entry with `bindings` also lists `$dynamic` when the group exists, since any handler may change a path a dynamic hole read. The loader and `renderPreload` then load the chunk with the handler.
6. The server module exports no new name. It imports `track` from `idlip/server`, declares `const dynamic$ = {}` and passes `dynamic: dynamic$` to `context.state`.
7. Loader code is behind `HAS_DYNAMIC`, on when a manifest has the `$dynamic` group.

## Affected nodes

`nesting-compile`, `nesting-runtime` (children have no `dynamic`).

## Workaround in place

As described. `core/helpers.ts` lists `track$` as a copied helper.

## Decision

Applied in v11 from the landed code.
