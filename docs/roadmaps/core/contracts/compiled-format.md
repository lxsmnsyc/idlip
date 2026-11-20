---
name: compiled-format
version: 4
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
- State encoding: which seroval output the server writes and where its reader lives. Brumate writes seroval code records that the core calls, which took its core from 14,971 B to about 4.8 kB gzip (`../brumate/docs/compiler.md`). The node sets a gzip budget for the loader, and `e2e-harness` checks it.
- Early events: how events that fire before the loader runs are kept, for example a small inline script that queues them. It must make the `e2e-harness` test pass that clicks before scripts finish loading.
- Event modifiers: `prevent`, `stop`, `once`, `capture`, `passive` and key filters such as `Enter` or `Mod+s`. They are encoded in the DOM, and the loader applies them synchronously before any chunk loads, since a handler that runs later cannot call `preventDefault`. The authoring syntax is decided with `jsx-types`. One candidate is a wrapper on the message, `on:submit={prevent(msg.add())}`.
- HTML parser rules: the HTML parser rewrites some nestings, such as a block element inside `<p>`, `<li>` outside a list, or rows outside table sections. For each, the compiler rejects it or the encoding keeps markers that survive the rewrite. Text inside `<textarea>` and `<title>` changes only as whole content.
- Manifest: message tag to chunk, binding group to chunk and path set, list block to item template chunk.
- Reserved manifest fields for a message tag, from `docs/proposals/0003-update-analysis.md`: `writes` (the write set) and `bindings` (binding groups whose read sets intersect it). An entry holds either `chunk` or `ops`. Nodes before `write-sets` may leave `writes` and `bindings` out.
- Module shapes: server render function, update handler chunk, binding chunk, item template chunk.
- Compiler API: `compile(source, id)` returning server module, client modules, manifest and diagnostics.
- Patcher interface called by the loader: `patch(root, oldModel, newModel, manifest): Promise<void>`. It loads chunks, so it is async. The loader awaits it before the next queued message.
- Path diff: `diffPaths(oldModel, newModel, pathSets): Set<string>`, owned by `patch-bindings`.
- List patcher: `patchList(block, oldList, newList, context): Promise<void>`, implemented by `patch-lists` and called from `patch()`.
- Effects seam: `runCmd(cmd, dispatch): Promise<void>` loads the executor for `cmd.kind` lazily. `startSubs(subs, dispatch)` starts the subscriptions listed in the state script. Implemented by `commands-subs`, called by `resume-loader`.

## Behavior

- Delegated listeners use `focusin` and `focusout` or the capture phase for events that do not bubble, such as `focus` and `blur`.
- The loader resolves `$event` and `$form` placeholders synchronously when the event fires, not when the chunk arrives. Queued `input` events then keep the value each one had.
- The state script and any inline script take a CSP nonce from the render options. Marker and event attribute names are reserved, and the compiler rejects them in author markup.
- A message in the DOM is the tuple `[tag, payload]`, which `JSON.parse` reads, apart from `$event` placeholders. The loader turns it into `Message` (`{ t, p }`) after resolving the placeholders.
- A nested module's message carries the model path of the module that handles it, for example `left`, or `counters` and `c7` for a list item with key `c7`. The encoding must keep the path apart from the tag, because a payload can be a string. The `nesting` node defines routing. Until then a message has no path.
- Module source files are `*.idlip.tsx` with one default export, the `defineModule` result (`contracts/core-api.md`). Update handler chunks come from the keys of its `update` property.
- Path sets use `*` for list items, for example `todos.*.done`.
- Reserved path syntax for keyed segments: `name[key=source]`, where `source` is `$p`, `$p.<field>` or a model path, for example `todos[id=$p].done`. The parser must reject it until `keyed-paths` lands, so no fixture uses it by accident.
- Reserved placeholder `["$form", name]`, read from the `FormData` of the event target's form. Implemented by `form-fields`.

## Stub

The golden fixtures are the stub for both sides.

## Contract tests

`packages/idlip/test/fixtures/`.

## Changes

- v4: adds the state encoding budget, early events, event modifiers, HTML parser rules, placeholder timing and CSP nonces. Source: runtime gap review against brumate, 2026-11-20.
- v3: reserves the manifest fields `writes`, `bindings` and `ops`, keyed path segments and the `$form` placeholder. Source: `docs/proposals/0003-update-analysis.md`.
- v2: message path instead of leading tags, `*.idlip.tsx` default export modules, room for `dynamic` path sets in the state script. Source: `docs/proposals/0002-modules.md`.
- v1: initial draft.
