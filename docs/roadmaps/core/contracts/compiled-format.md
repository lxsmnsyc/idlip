---
name: compiled-format
version: 7
status: draft
defined_by: compiled-format
---

# Contract: compiled-format

## Purpose

The seam between the compiler (`compile-update`, `compile-view-codegen`, `vite-plugin`) and the runtime (`ssr-render`, `resume-loader`, `patch-bindings`, `patch-lists`). Both sides test against the golden fixtures in `packages/idlip/test/fixtures/`.

## Interface

To be decided by the `compiled-format` node. It must define:

- DOM encoding: event attributes, `$event` placeholders for event paths read at dispatch (`e.currentTarget.value`), binding markers, list keys.
- State script: element, seroval payload, root props, recorded path sets of `dynamic` holes (used once `dynamic-paths` lands).
- State encoding: which seroval output the server writes and where its reader lives. Brumate writes seroval code records that the core calls, which took its core from 14,971 B to about 4.8 kB gzip (`../brumate/docs/compiler.md`). The node sets a gzip budget for the loader, and `e2e-harness` checks it.
- Early events: how events that fire before the loader runs are kept, for example a small inline script that queues them. It must make the `e2e-harness` test pass that clicks before scripts finish loading.
- Event modifiers: `prevent`, `stop`, `once`, `capture`, `passive` and key filters such as `Enter` or `Mod+s`. They are encoded in the DOM, and the loader applies them synchronously before any chunk loads, since a handler that runs later cannot call `preventDefault`. The authoring syntax is decided with `jsx-types` and must not be a compile-time API. One candidate: the compiler recognizes `e.preventDefault()` and `e.stopPropagation()` as the first statements of an event arrow, `(e) => { e.preventDefault(); add(); }`, which also means the same when run as plain TypeScript.
- HTML parser rules: the HTML parser rewrites some nestings, such as a block element inside `<p>`, `<li>` inside `<li>`, or rows outside table sections. `<li>` outside a list is not rewritten (`spike-view-analysis` outcome). For each, the compiler rejects it or the encoding keeps markers that survive the rewrite. Text inside `<textarea>` and `<title>` changes only as whole content.
- Manifest: message tag to chunk, binding group to chunk and path set, list block to item template chunk.
- Reserved manifest fields for a message tag, from `docs/proposals/0003-update-analysis.md`: `writes` (the write set) and `bindings` (binding groups whose read sets intersect it). An entry holds either `chunk` or `ops`. Nodes before `write-sets` may leave `writes` and `bindings` out.
- Module shapes: server render function, update handler chunk, binding chunk, item template chunk.
- Compiler API: `compile(source, id)` returning server module, client modules, manifest and diagnostics.
- Patcher interface called by the loader: `patch(root, oldModel, newModel, manifest): Promise<void>`. It loads chunks, so it is async. The loader awaits it before the next queued message.
- Path diff: `diffPaths(oldModel, newModel, pathSets): Set<string>`, owned by `patch-bindings`.
- List patcher: `patchList(block, oldList, newList, context): Promise<void>`, implemented by `patch-lists` and called from `patch()`.
- Effects seam: `runTask(task, dispatch): Promise<void>` loads the chunk of an awaited call site, runs it, and dispatches the continuation message with the result or the error. Implemented by `custom-effects`, called by `resume-loader`. Subscription seam, reserved for `commands-subs`: the server renders a marker per active `<Subscribe>` with the source chunk id and the serialized input, and the loader starts the sources whose markers are in the page.
- Block hook: `onBlock(add, remove)`, owned by `patch-bindings`. `patch()` calls it when it adds or removes a condition block, `patchList` for `<For>` rows, `document-head` for head blocks and `errors` for a `<Try>` region swap. Children are removed before parents. A registered start is not awaited by `patch()`. `commands-subs` registers subscription start and stop on it. Source: `docs/roadmaps/core/debates/subscriptions/debate.md`.

## Behavior

- Delegated listeners use `focusin` and `focusout` or the capture phase for events that do not bubble, such as `focus` and `blur`.
- The loader resolves `$event` and `$form` placeholders synchronously when the event fires, not when the chunk arrives. Queued `input` events then keep the value each one had.
- The state script and any inline script take a CSP nonce from the render options. Marker and event attribute names are reserved, and the compiler rejects them in author markup.
- A message in the DOM is the tuple `[tag, payload]`, where the tag is the handler's name and the payload is the array of its arguments, which `JSON.parse` reads, apart from `$event` placeholders. The loader turns it into `Message` (`{ t, p }`) after resolving the placeholders.
- A nested component's message carries the model path of the component that handles it, for example `left`, or `counters` and `c7` for a list item with key `c7`. The encoding must keep the path apart from the tag, because a payload can be a string. The `nesting` node defines routing. Until then a message has no path.
- Module source files are `*.idlip.tsx` that export function components (`docs/proposals/0002-modules.md`). Update handler chunks come from the function declarations in a component body. All segments of an async handler share its chunk; continuation tags are the handler name with `$1`, `$2` and so on. When a segment awaits `Random` or `Time`, the loader waits for the continuation before it patches.
- Path sets use `*` for list items, for example `todos.*.done`.
- Reserved path syntax for keyed segments: `name[key=source]`, where `source` is `$p`, `$p.<field>` or a model path, for example `todos[id=$p].done`. The parser must reject it until `keyed-paths` lands, so no fixture uses it by accident.
- `latest:name` event attributes are encoded in the DOM like `on:name` with a latest-wins flag. While the handler's chunk loads or a patch runs, a new event replaces the pending one for the same element and event name. Other events queue with their own values. `on:x` and `latest:x` on one element is a compile error. `<window>` and `<document>` listeners are encoded on a reserved marker and delegated by the loader.
- Reserved placeholder `["$form", name]`, read from the `FormData` of the event target's form. Implemented by `form-fields`.
- Templates inside `<svg>` and `<math>` keep their namespace, including item templates and condition block templates created on the client. The encoding records the namespace of each template.
- Reserved: a ref marker attribute on elements with `ref`, scoped by component path. Implemented by `dom-refs`.
- Reserved: a raw HTML binding that sets `innerHTML` from a `TrustedHtml` value. Implemented by `svg-and-html`.
- Reserved manifest field `tasks`: awaited call site id to chunk. Implemented by `custom-effects`.
- Reserved: boundary markers around each `<Try>` region and a `fallback` manifest field (chunk of its `catch` template). Implemented by `errors`.
- Reserved: head block markers and the title rule (last title wins). Implemented by `document-head`.

## Stub

The golden fixtures are the stub for both sides.

## Contract tests

`packages/idlip/test/fixtures/`.

## Changes

- v7: block hook `onBlock`, `latest:` event attributes, `<window>` and `<document>` listeners, and the `<Subscribe>` marker with source chunk id and input. Source: `docs/roadmaps/core/debates/subscriptions/debate.md`, 2026-11-21.
- v6: function components replace `defineModule`. Tags are handler names and payloads are argument arrays. Continuation chunks and tags for `await`. `runTask` replaces `runCmd` and `startSubs`. Subscriptions become markers in the page instead of a list in the state script. One chunk per handler, with its continuations. Source: `docs/proposals/0002-modules.md` and `docs/proposals/0004-effects-refs-errors.md`, revised 2026-11-21.
- v5: SVG and MathML namespaces, and reserved ref markers, raw HTML bindings, effect and fallback manifest fields and boundary markers. Source: `docs/proposals/0004-effects-refs-errors.md`.
- v4: adds the state encoding budget, early events, event modifiers, HTML parser rules, placeholder timing and CSP nonces. Source: runtime gap review against brumate, 2026-11-20.
- v3: reserves the manifest fields `writes`, `bindings` and `ops`, keyed path segments and the `$form` placeholder. Source: `docs/proposals/0003-update-analysis.md`.
- v2: message path instead of leading tags, `*.idlip.tsx` default export modules, room for `dynamic` path sets in the state script. Source: `docs/proposals/0002-modules.md`.
- v1: initial draft.
