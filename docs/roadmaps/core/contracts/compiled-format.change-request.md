# Change request: compiled-format v7 to v8

- From node: compiled-format
- Status: accepted and applied by the orchestrator on 2026-11-21, after two fresh review rounds.

## Problem

The contract is a draft that lists the parts to decide. Every compiler and runtime node of the `todo-resumes` milestone needs the decided format before it can start. Workers may not edit contracts, so the frozen text lives in the node folder.

## Proposed change

Copy `docs/roadmaps/core/nodes/compiled-format/compiled-format.proposed.md` over `docs/roadmaps/core/contracts/compiled-format.md`. It sets `status: frozen` and `version: 8`, and has no TBD left.

The main decisions:

- DOM: binding ids are the view-ir hole ids, then one id per event whose payload changes. Elements carry `i-a="<ids>"`. Text, conditions, lists and rows are comment pairs (`t`, `c`, `l`, `i`). Rows carry no key, because the old model gives the row order.
- Events: `on:<event>='[tag, payload, modifiers?]'`. Top-level placeholders `["$event", ...segments]`. Modifiers `prevent`, `stop`, `once`, `capture`, `passive`, `latest` and `key:<filter>`.
- State: one inline script per root that pushes `[eventTypes, () => seroval output]` to `self.$idlip`. The client never imports seroval and decodes the state on the first event only.
- Early events: an inline listener in `<head>` queues resolved messages. The loader takes over the queue. Budgets: listener 1024 B gzip, loader 4096 B gzip.
- Manifest: handlers, binding groups by path set with `covers`, and lists. A group's chunk also patches the groups it covers, so the todo's first click loads `handler=toggle` and `binding=todos.*.done` only.
- A `*` path under a keyed `<For>` changes in `diffPaths` when it differs by key or by index, so neither a row binding nor a hole outside the rows goes stale after a reorder.
- Chunk URLs: `manifest.module` is the root-relative Vite id, chunk ids are `<module>?idlip-<kind>=<name>&lang.js`, and each state record carries `chunks`, the id-to-URL map of the modules on the page, which `vite-plugin` produces.
- Module shapes, render and patch helpers, runtime seam types (`patch(page, prev, next)` replaces `patch(root, oldModel, newModel, manifest)`), the compiler API and the HTML parser rules.

## Affected nodes

`compile-update`, `compile-view-codegen`, `compile-integration`, `vite-plugin`, `ssr-render`, `resume-loader`, `patch-bindings`, `patch-lists`, `e2e-harness`, `example-todo`, and the later nodes that fill reserved parts (`nesting`, `custom-effects`, `commands-subs`, `errors`, `document-head`, `dom-refs`, `svg-and-html`, `form-fields`, `write-sets`, `update-ops`, `keyed-paths`, `dynamic-paths`).

## Workaround in place

The types are in `packages/idlip/src/core/format.ts` and the fixtures in `packages/idlip/test/fixtures/`, both on `feat/compiled-format`. They follow the proposed text.

## Decision
