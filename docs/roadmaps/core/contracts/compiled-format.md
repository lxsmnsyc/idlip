---
name: compiled-format
version: 2
status: draft
defined_by: compiled-format
---

# Contract: compiled-format

## Purpose

The seam between the compiler (`compile-update`, `compile-view-codegen`, `vite-plugin`) and the runtime (`ssr-render`, `resume-loader`, `patch-bindings`, `patch-lists`). Both sides test against the golden fixtures in `packages/idlip/test/fixtures/`.

## Interface

To be decided by the `compiled-format` node. It must define:

- DOM encoding: event attributes, `$event` placeholders, binding markers, list keys.
- State script: element, seroval payload, subscription list, recorded path sets of `dynamic` holes (used once `dynamic-paths` lands).
- Manifest: message tag to chunk, binding group to chunk and path set, list block to item template chunk.
- Module shapes: server render function, update handler chunk, binding chunk, item template chunk.
- Compiler API: `compile(source, id)` returning server module, client modules, manifest and diagnostics.
- Patcher interface called by the loader: `patch(root, oldModel, newModel, manifest): Promise<void>`. It loads chunks, so it is async. The loader awaits it before the next queued message.
- Path diff: `diffPaths(oldModel, newModel, pathSets): Set<string>`, owned by `patch-bindings`.
- List patcher: `patchList(block, oldList, newList, context): Promise<void>`, implemented by `patch-lists` and called from `patch()`.
- Effects seam: `runCmd(cmd, dispatch): Promise<void>` loads the executor for `cmd.kind` lazily. `startSubs(subs, dispatch)` starts the subscriptions listed in the state script. Implemented by `commands-subs`, called by `resume-loader`.

## Behavior

- A message in the DOM is the tuple `[tag, payload]`, which `JSON.parse` reads, apart from `$event` placeholders. The loader turns it into `Message` (`{ t, p }`) after resolving the placeholders.
- A nested module's message carries the model path of the module that handles it, for example `left`, or `counters` and `c7` for a list item with key `c7`. The encoding must keep the path apart from the tag, because a payload can be a string. The `nesting` node defines routing. Until then a message has no path.
- Module source files are `*.idlip.tsx` with one default export, the `defineModule` result (`contracts/core-api.md`). Update handler chunks come from the keys of its `update` property.
- Path sets use `*` for list items, for example `todos.*.done`.

## Stub

The golden fixtures are the stub for both sides.

## Contract tests

`packages/idlip/test/fixtures/`.

## Changes

- v2: message path instead of leading tags, `*.idlip.tsx` default export modules, room for `dynamic` path sets in the state script. Source: `docs/proposals/0002-modules.md`.
- v1: initial draft.
