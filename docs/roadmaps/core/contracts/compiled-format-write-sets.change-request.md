# Change request: compiled-format, write sets

- From node: write-sets
- Status: open

## Problem

`HandlerEntry.writes` and `HandlerEntry.bindings` are reserved but undefined. The loader loads the handler chunk first and the binding chunks after the diff, which costs two round trips on the first click.

## Proposed change

1. Manifest: `manifest.handlers[tag].writes` is a list of model paths the handler can change, such as `todos.*.done`. Continuation tags have the write set of their whole handler. `bindings` is the list of group keys to load with the handler: the groups with a path that meets a write, minus every group that another listed group covers (`BindingGroup.covers`). Both are absent when the analysis cannot read a write.
2. Meeting: two paths meet when one is a prefix of the other, segment by segment. `*` matches any item, and a keyed segment `name[field=source]` counts as `name.*`. `meetsPath` in `compiler/update/writes.ts` implements it. Only the compiler uses it.
3. Analysis: a write to a state `let` is its field name. `x = x.map((t) => (<test> ? { ...t, f: <e> } : t))` is `x.*.f` for each field `f` the object sets after the spread. Any other write to `x` (an update, a compound assignment, a destructuring target, another map form) is `x`. A handler's set is the union over the handler and the handlers it calls. It is an upper bound. A handler that changes state in place (`todos.push(...)`, `todos[0].done = true`, `cfg.n++`, `delete`) or in a way the analysis cannot read has no `writes`.
4. Loading: on an event, the loader starts the handler chunk and the chunks of `bindings` together. A binding chunk that fails to load is not reported there. The patch asks for it again through `page.load`, which keeps the same promise or retries. An entry without `bindings` loads the handler chunk alone.
5. `Patch` is unchanged. The patcher still diffs every group path, which is cheap. Narrowing the diff by `writes` is not part of this change.

## Affected nodes

`keyed-writes` (keyed write paths), `update-ops` (exact write sets), `prefetch` (reads `bindings`), `custom-effects`, `run-tasks` (share `resume.ts` and the manifest).

## Workaround in place

Implemented in `packages/idlip/src/compiler/update/writes.ts`, `src/compiler/view/codegen/index.ts` and `src/client/loader/resume.ts`.

## Decision

Pending.
