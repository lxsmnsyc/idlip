---
name: compiled-format
version: 1
status: draft
defined_by: compiled-format
---

# Contract: compiled-format

## Purpose

The seam between the compiler (`compile-update`, `compile-view-codegen`, `vite-plugin`) and the runtime (`ssr-render`, `resume-loader`, `patch-bindings`, `patch-lists`). Both sides test against the golden fixtures in `packages/idlip/test/fixtures/`.

## Interface

To be decided by the `compiled-format` node. It must define:

- DOM encoding: event attributes, `$event` placeholders, binding markers, list keys.
- State script: element, seroval payload, subscription list.
- Manifest: message tag to chunk, binding group to chunk and path set, list block to item template chunk.
- Module shapes: server render function, update handler chunk, binding chunk, item template chunk.
- Compiler API: `compile(source, id)` returning server module, client modules, manifest and diagnostics.
- Patcher interface called by the loader: `patch(root, oldModel, newModel, manifest): Promise<void>`. It loads chunks, so it is async. The loader awaits it before the next queued message.
- Path diff: `diffPaths(oldModel, newModel, pathSets): Set<string>`, owned by `patch-bindings`.
- List patcher: `patchList(block, oldList, newList, context): Promise<void>`, implemented by `patch-lists` and called from `patch()`.
- Effects seam: `runCmd(cmd, dispatch): Promise<void>` loads the executor for `cmd.kind` lazily. `startSubs(subs, dispatch)` starts the subscriptions listed in the state script. Implemented by `commands-subs`, called by `resume-loader`.

## Behavior

- A message in the DOM is the tuple `[tag, payload]`, which `JSON.parse` reads, apart from `$event` placeholders. The loader turns it into `Message` (`{ t, p }`) after resolving the placeholders.
- A nested module's message carries its prefixes as leading tags, for example `["left","increment"]`. The `nesting` node defines routing. Until then a tag has no prefix.
- Path sets use `*` for list items, for example `todos.*.done`.

## Stub

The golden fixtures are the stub for both sides.

## Contract tests

`packages/idlip/test/fixtures/`.

## Changes

- v1: initial draft.
