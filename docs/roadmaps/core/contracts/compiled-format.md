---
name: compiled-format
version: 9
status: frozen
defined_by: compiled-format
---

# Contract: compiled-format

## Purpose

The seam between the compiler (`compile-update`, `compile-view-codegen`, `compile-integration`, `vite-plugin`) and the runtime (`ssr-render`, `resume-loader`, `patch-bindings`, `patch-lists`). Both sides test against the golden fixtures in `packages/idlip/test/fixtures/`. The types are in `packages/idlip/src/core/format.ts`. This text says what each one means.

## Interface

`src/core/format.ts` exports:

| Type or function                                                                            | What it is                                                |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `Message`                                                                                   | `{ t, p }`: a tag and the payload array.                  |
| `DomMessage`, `Placeholder`                                                                 | The JSON in an `on:<event>` attribute.                    |
| `Model`, `Props`                                                                            | State fields by name, props by name.                      |
| `Manifest`, `HandlerEntry`, `BindingGroup`, `ListEntry`                                     | The manifest of one module.                               |
| `PageState`, `ChunkUrls`, `StateRecord`, `QueuedEvent`, `Boot`                              | The state script, the listener's queue and `self.$idlip`. |
| `RenderContext`, `ServerRender`, `ServerModule`                                             | The compiled server module.                               |
| `Scope`, `Row`, `NodeBinding`, `ListBinding`, `Binding`                                     | What client chunks read and export.                       |
| `Update`, `Step`, `Task`, `Outcome`                                                         | Handler exports and the async seam.                       |
| `HandlerChunk`, `BindingChunk`, `ListChunk`                                                 | The three client chunk shapes.                            |
| `LoadChunk`, `Page`, `Patch`, `DiffPaths`, `ListContext`, `PatchList`, `OnBlock`, `RunTask` | Runtime seams.                                            |
| `Module`, `CompileDiagnostic`, `CompileResult`, `Compile`                                   | The compiler API.                                         |
| `getChunkFile(chunk)`, `getChunkId(module, chunk)`                                          | File name and Vite module id of a chunk.                  |

The runtime seams:

```ts
type LoadChunk = (module: string, chunk: string) => Promise<unknown>;
type Patch = (page: Page, prev: Model, next: Model) => Promise<void>; // patch-bindings
type DiffPaths = (
  prev: Model,
  next: Model,
  paths: readonly string[],
  keys: Readonly<Record<string, string>>,
) => Set<string>; // patch-bindings
type PatchList = (
  start: Comment,
  prev: readonly unknown[],
  next: readonly unknown[],
  context: ListContext,
) => Promise<void>; // patch-lists
type OnBlock = (add: (start: Comment) => void, remove: (start: Comment) => void) => void; // patch-bindings
type RunTask = (task: Task, dispatch: (message: Message) => void) => Promise<void>; // custom-effects
type Compile = (source: string, id: string) => CompileResult; // idlip/compiler
```

## Behavior

### Binding ids

Every place the client patches has a binding id, a number unique within the component:

- The hole ids of `contracts/view-ir.md`, in view order.
- Then one id per event whose payload changes: an event with `paths`, or whose handler reads a props path of a child component. Root props never change, so the root's events need none. Ids continue after the last hole id, in view order. In the todo, `on:click={() => toggle(t.id)}` gets id 7 after holes 0 to 6.

A binding's export name is its kind and its id: `a<id>` for an element binding (attribute, property, class or event payload), `t<id>` for a text hole, `c<id>` for a condition block, `l<id>` for a `<For>` block.

### DOM encoding

All names below are reserved. The compiler rejects an author attribute that starts with `i-` (`attr-reserved`, see the view-ir change request).

- **Element anchor.** An element with an `a` binding carries `i-a="<ids>"`, its binding ids separated by spaces, such as `i-a="5 7"`. It is the last attribute.
- **Text.** A text hole is `<!--t<id>-->value<!--/t-->`. An empty value still writes both comments.
- **Condition.** `<!--c<id>:<branch>-->…<!--/c-->`. The branch is `0` for `then` and `1` for `else`. An empty branch writes both comments. A chained ternary nests a condition in the `else` branch.
- **List.** `<!--l<id>-->…<!--/l-->`, and each row `<!--i-->…<!--/i-->`. Rows carry no key: the DOM always matches the old model, so the old list gives each row's key by its position.
- **Attribute order.** Static and hole attributes in source order, then events in source order, then `i-a`.
- Every range is a comment pair. Markers of nested blocks nest. A lookup that finds no node skips the binding, which happens for bindings inside a branch that is not rendered.

### Values

- Text: `null`, `undefined`, `true` and `false` render as nothing. Other values render as `String(value)`. On the server, `&`, `<` and `>` are escaped.
- Attributes: `false`, `null` and `undefined` leave the attribute out. `true` writes the bare name. Other values write `String(value)` in double quotes, with `&` and `"` escaped.
- `class` may take an object: the names whose values are truthy, joined by spaces, in object order. No name leaves the attribute out. Other attributes do not take objects.
- `value`, `checked` and `selected`: the server writes the attribute. The client sets the property, because the attribute only sets the default once the user has typed or clicked.
- `<textarea>` content renders after a newline, which the parser drops, so a value that starts with a newline keeps it.

### Events

An event is an attribute `on:<event>='<json>'`, in single quotes, with `&` and `'` escaped. The JSON is a `DomMessage`:

```text
on:click='["toggle",["a1"]]'
on:input='["setDraft",[["$event","currentTarget","value"]]]'
on:submit='["add",[],"prevent"]'
on:keydown='["clear",[],"key:Escape"]'
```

- Item 0 is the tag, the handler's name. Item 1 is the payload: the values of the props paths the handler reads, then the handler's arguments. The props paths are the handler's own (`free` of kind `props` in the IR), then those of the handlers it calls, as `listHandlerProps(component, handler)` in `src/compiler/update/` returns them. The counter's `reset` reads `props.start`, so it renders as `["reset",[4]]`.
- Item 2, when present, lists the modifiers, separated by spaces.
- **Placeholders.** A top-level payload item that is an array whose first item is a string starting with `$` is a placeholder. `["$event", ...segments]` reads the segments from the event when it fires. The segment `currentTarget` is the element that carries the attribute, since the delegated listener's `currentTarget` is the document. `["$form", name]` is reserved for `form-fields`. `["$", ...items]` is a literal array whose first item starts with `$`: the compiler writes such a literal argument that way, and the listener drops the `$`. Items below the top level are never placeholders.
- An event argument that reads the event must be a whole argument that is a path on the event, such as `e.currentTarget.value`. Any other use of the event in an argument is `event-placeholder` (view-ir change request).
- The listener resolves placeholders synchronously when the event fires, not when the chunk arrives. Queued `input` events keep the value each one had.
- One element has at most one handler per event name.

### Modifiers

| Modifier       | Meaning                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prevent`      | The listener calls `preventDefault()` when the event fires.                                                                                      |
| `stop`         | The listener calls `stopPropagation()` and does not look at outer elements for the same event.                                                   |
| `once`         | The listener removes the attribute after the first message. It stays removed: a later `setOn` for that element and event does not write it back. |
| `capture`      | The handler runs in a capture-phase pass, outermost element first, before bubble-phase handlers.                                                 |
| `passive`      | The listener never calls `preventDefault()` for it. `passive` with `prevent` is the compile error `event-passive-prevent`.                       |
| `latest`       | Latest-wins: while the handler's chunk loads or a patch runs, a new event replaces the pending one of the same element and event name.           |
| `key:<filter>` | The event is ignored unless the filter matches. Checked before every other modifier.                                                             |

A key filter is `[Ctrl+][Alt+][Shift+][Meta+][Mod+]<key>`. `<key>` is compared with `event.key`, ignoring case for a single letter. Each named modifier key must be pressed. Modifier keys not named are not checked, the way `e.key === 'Enter'` in TypeScript also matches Shift+Enter. `Mod` is Meta on Apple platforms and Ctrl elsewhere.

`latest:<event>` in the source is `on:<event>` with the `latest` modifier. `on:x` and `latest:x` on one element is a compile error (`event-mode-twice`).

Authoring: an event arrow may have a block body that reads as plain TypeScript and means the same when run. `contracts/view-ir-v9.change-request.md` proposes it to view-ir, and `jsx-types` keeps its types.

```tsx
<form on:submit={(e) => { e.preventDefault(); add(); }}>
<input on:keydown={(e) => { if (e.key === 'Escape') { clear(); } }} />
<input on:keydown={(e) => { if (e.ctrlKey && e.key === 's') { e.preventDefault(); save(); } }} />
```

- Leading `e.preventDefault();` and `e.stopPropagation();` statements give `prevent` and `stop`, then one handler call.
- `if (<test>) <call>` or `if (<test>) { <prevent or stop statements> <call> }` gives a key filter. The test is `e.key === '<key>'`, joined with `&&` to any of `e.ctrlKey`, `e.altKey`, `e.shiftKey`, `e.metaKey`. Prevent and stop statements before the `if` are a compile error, since they would apply to keys the filter rejects.
- `once`, `capture`, `passive` and `Mod` have no source form yet. The encoding is fixed, so a later source form needs no format change.

### Delegated listening

- `<window>` and `<document>` render `<template i-global="window" on:keydown='…'></template>` at their position in the view. The listener adds those listeners on `window` or `document`, and finds the messages in the templates.
- Other events use one listener per event type on `document`, in the bubble phase. It walks from the target outwards and takes the first element with `on:<type>`, unless `stop` ends the walk earlier.
- Events that do not bubble (`focus`, `blur`, `mouseenter`, `mouseleave`, `pointerenter`, `pointerleave`, `load`, `error`, `scroll`) use a capture-phase listener and match only `event.target`, with no outward walk. A walk would fire an ancestor's `on:focus` when a child takes focus, which the browser never does.
- A type whose handlers are all `passive` is listed as `<type>:passive` in the state record, and its document listener is passive.

### State script

The server writes one state script per rendered root, after its markup, on one line (the formatter wraps it here):

```html
<script i-state>
  (self.$idlip||=[]).push(["click input keydown submit",()=>({manifest:{…},model:{…},props:{}})])
</script>
```

- The pushed value is a `StateRecord`: the event types, separated by spaces, and a function that returns the `PageState`. The function body is seroval's `serialize()` output for `{ manifest, chunks, model, props }`. The record relies on that output being a parenthesized expression, `({…})` or `(h=>…)()`, so it serves as the arrow body as it is. A seroval upgrade that changes this breaks the format.
- The client never imports seroval. Running the function decodes the state, as brumate's code records do (`../brumate/docs/compiler.md`: that change took its core from 14,971 B to about 4.8 kB gzip). The loader calls the function on the first event only, so a page that never gets an event never decodes its state.
- seroval writes `<` in a string as `\x3C` and escapes U+2028 and U+2029, so a value cannot end the script.
- `chunks` is the chunk URL map (see Chunk URLs) for the modules rendered on the page, and only those.
- `model` is the component's state fields. `props` holds only the props fields that some binding reads. Handlers get the props they read through the payload. Both fixtures have `props: {}`.
- With a `nonce` render option, the script is `<script i-state nonce="…">`.
- Reserved for `dynamic-paths`: a `dynamic` field in `PageState` with the recorded path sets of dynamic holes.

### Listener and early events

- The listener is a small inline script that the host page puts in `<head>`, so events that fire before the loader module runs are kept. `idlip/server` exports it as `renderListener({ nonce })`, which returns the script tag (`contracts/core-api.change-request.md`, core-api v9). `resume-loader` implements it. It is not part of `render()` output, so the fixture HTML does not depend on runtime code.
- `self.$idlip` is a `Boot`: an array of state records with a queue `q`. The listener replaces `push`, so it adds the listeners of each record's event types as soon as the record is pushed, and adds those of records pushed before it ran.
- On an event, the listener finds the element, applies the key filter and the modifiers synchronously, resolves placeholders, and pushes a `QueuedEvent` to `q`.
- The loader takes over `q`: it handles the queued events in order and replaces `q.push`, so later events go straight to it. Taking over an array by draining it and replacing its `push` is the one hand-off rule for both arrays.
- Budgets, checked by `e2e-harness` on the production build with `gzip -9`: the listener script at most 1024 B gzip, the loader module with its static imports at most 4096 B gzip. Chunks are not counted. The loader's static graph includes `idlip/client` with `patch`, `patchList`, `diffPaths` and the helpers (`setAttr`, `setText`, `setOn`, `setBranch`, `attr`, `on`, `text`), so a binding chunk's import of `idlip/client` is already loaded and the first click costs no third request.

### Manifest

```json
{
  "module": "/src/todo.idlip.tsx",
  "events": ["click", "input", "keydown", "submit"],
  "handlers": { "toggle": { "chunk": "handler=toggle" } },
  "groups": {
    "todos.*.done": {
      "paths": ["todos.*.done"],
      "chunk": "binding=todos.*.done",
      "bindings": ["a4", "a5"],
      "covers": ["todos"]
    },
    "todos": {
      "paths": ["todos"],
      "chunk": "binding=todos",
      "bindings": ["t2", "l3"],
      "covers": []
    }
  },
  "lists": {
    "3": { "key": "id", "path": "todos", "chunk": "list=3", "bindings": ["a4", "a5", "t6", "a7"] }
  }
}
```

- `handlers`: every message tag to its chunk. Continuation tags (`add$1`) have their own entries with their handler's chunk, so the loader never parses a tag. Reserved for `write-sets`: `writes` and `bindings` on an entry. Reserved for `update-ops`: an entry with `ops` instead of `chunk`.
- `groups`: one per distinct path set among the bindings. The key is the paths joined by `,`. `bindings` lists the export names of the group's own bindings.
- `lists`: each `<For>` by binding id, written as a string key. An entry has the `key` prop, `path` (the path of `each` when it is a path, such as `todos` or `columns.*.cards`; absent for a helper call), the item template chunk, and the bindings directly inside a row. A nested list also has `parent`, the id of the enclosing list as a string.
- Chunk names: `handler=<tag>`, `binding=<group key>`, `list=<id>`. The file name is `getChunkFile(chunk)`: `=` becomes `.`, `*` becomes `_` and `,` becomes `+`, so `binding=todos.*.done` is `binding.todos._.done.js`. The fixtures and the `name` of an emitted chunk use it.
- Path sets use `*` for list items. Reserved for `keyed-paths`: `name[key=source]`, where `source` is `$p`, `$p.<field>` or a model path, such as `todos[id=$p].done`. Parsers reject it until that node lands.
- Reserved fields: `tasks` (awaited call site id to chunk, `custom-effects`) and `fallback` on a `<Try>` region (`errors`).

### Chunk URLs

- `manifest.module` is the module's root-relative Vite id, such as `/src/todo.idlip.tsx`. `compile(source, id)` takes it as `id`.
- A chunk id is `getChunkId(module, chunk)`: `<module>?idlip-<chunk>&lang.js`, so `/src/todo.idlip.tsx?idlip-handler=toggle&lang.js`, `?idlip-binding=todos.*.done&lang.js` and `?idlip-list=3&lang.js`. This is the scheme of `spike-chunk-split`, with the three chunk kinds above. The id ends in `&lang.js` because Vite reads the loader from the end of the id, and binding names contain dots.
- `ChunkUrls` maps chunk id to URL. `vite-plugin` produces it. In dev the id is the URL. In a build the URL comes from the client build's manifest.
- The compiled server module exports `chunks`, its own entries of the map. `compile()` writes each id as its own URL, and `vite-plugin` replaces the values with built URLs in the server build. The server module passes it to `context.state`.
- `ssr-render` writes into each state record only the entries of the modules rendered on the page, as `PageState.chunks`.
- The loader reads it from there: `LoadChunk(module, chunk)` imports `chunks[getChunkId(module, chunk)]`.

### Covers

Group A covers group B when every path of A has a prefix in B's paths, or equals one. Updates are immutable, so every change under A also changes B. A's chunk then holds B's bindings too, and loading it patches both.

- In `groups`, a group comes before every group it covers. The compiler orders groups topologically by the covers relation; ties go by longest path, most segments first, then by key. Sorting by longest path alone is not enough: `[a.b]` covers `[a.b, c.d.e]` but has the shorter longest path.
- The patcher walks `groups` in order. For each changed group not yet handled, it loads the group's chunk and marks the group and the groups it covers as handled.
- Why: toggling a todo changes `todos.*.done` and `todos`, and `{left}` reads `todos`. With covers, the first click loads `handler=toggle` and `binding=todos.*.done` and nothing else, which is the GOAL's count. A covered binding is copied into each covering chunk, as helpers are (`spike-chunk-split` outcome, Gotchas).

### Server module

The compiler emits one server module per `*.idlip.tsx` file, as plain `.js` code:

```js
import { attr, on, text } from 'idlip/server';
export const manifest = {/* the module's manifest */};
export const chunks = {
  '/src/todo.idlip.tsx?idlip-handler=toggle&lang.js':
    '/src/todo.idlip.tsx?idlip-handler=toggle&lang.js',
  /* one entry per chunk */
};
export default function TodoApp(props, context) {
  const draft = '';
  const todos = props.initial;
  context.state({ manifest, chunks, model: { draft, todos }, props: {} });
  return '<main>…</main>';
}
```

- The default export is a `ServerRender`: it computes the initial state from props, calls `context.state({ manifest, chunks, model, props })` once, and returns the markup. `render()` from `idlip/server` calls it, then writes the state script. Derived values are inlined, and module-level helpers are copied as they are.
- Static markup is string literals. Constant event attributes are literals. A render-time payload uses `on(event, message)`.
- The `manifest` export equals the `manifest` of `compile()`.

### Render helpers

`idlip/server` and `idlip/client` both export these, with the same output. The client uses them in templates.

| Helper               | Returns                                                          |
| -------------------- | ---------------------------------------------------------------- |
| `text(value)`        | Escaped text, by the rules in Values.                            |
| `attr(name, value)`  | ` name="…"`, ` name` or an empty string, by the rules in Values. |
| `on(event, message)` | ` on:<event>='<json>'`.                                          |

`idlip/client` also exports the patch helpers that binding chunks call:

| Helper                                  | Does                                                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setText(start, value)`                 | Sets the text between `start` and its end comment, adding a text node when there is none.                                                                           |
| `setAttr(el, name, value)`              | Sets or removes the attribute, or sets the property for `value`, `checked` and `selected`.                                                                          |
| `setOn(el, event, message)`             | Writes the `on:<event>` attribute.                                                                                                                                  |
| `setBranch(start, branch, render, ns?)` | When `branch` differs from the marker's, replaces the range with `render(branch)` and updates the marker. Calls the `onBlock` hooks. `ns` is `'svg'` or `'mathml'`. |

Client templates are HTML strings with the same markers as the server. The client parses them in a `<template>` element through a Trusted Types policy named `idlip`, so pages with a Trusted Types CSP work. Templates in `<svg>` or `<math>` are parsed inside a wrapper of that element, so they keep their namespace.

### Handler chunks

One chunk per handler, `handler=<tag>`, exporting a function named after the tag, and one for each continuation tag of an async handler.

```js
export function toggle(model, [id]) {
  let { todos } = model;
  todos = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  return { ...model, todos };
}
```

- An `Update` takes the model and the payload, and returns the next model or a `Step`. It reads the state it uses into locals, runs the body, and returns a new model with the written fields. Every `return` in the body returns that new model.
- Props values come before the arguments in the payload, named `props$<segments joined by $>` (`reset(model, [props$start])`). Props first keeps a rest parameter last: a handler that calls itself is `export function down(model, [props$k, ...$args])`.
- A handler called by another handler runs inline in the same chunk. Module-level helpers it reaches are copied in. Imports stay imports.
- Async handlers, implemented by `custom-effects`: a segment that ends at an `await` returns `{ model, task }`. `task.site` names the awaited call, `task.then` the continuation tag, `task.carried` the carried locals. The continuation's payload is `[outcome, ...carried]`, where `outcome` is `{ ok: true, value }` or `{ ok: false, error }`. All segments share the handler's chunk. When a segment awaits `Random` or `Time`, the loader waits for the continuation before it patches. `runTask(task, dispatch)` runs the task and dispatches the continuation.

### Binding chunks

One chunk per group, `binding=<key>`. It exports the group's bindings and those of the groups it covers, and nothing else.

```js
import { setAttr, setText } from 'idlip/client';
export function a5(el, { rows }) {
  setAttr(el, 'checked', rows[0].item.done);
}
export function t2(start, { model }) {
  setText(start, countLeft(model.todos));
}
export function l3({ model }) {
  return model.todos;
}
```

- `a`, `t` and `c` exports are `NodeBinding`s: `(node, scope)`. The node is the element with the id in `i-a`, or the start comment.
- An `l` export is a `ListBinding`: `(scope) => list`. The patcher calls `patchList(start, l(prevScope), l(nextScope), context)`. An `l` inside a row is a row binding of the enclosing list (see Patching).
- A `c` export computes the branch and calls `setBranch` with a local render function for its branches.
- `scope.rows` lists the enclosing rows, outermost first. A binding in a list at depth `d` reads its item as `rows[d].item` and its index as `rows[d].index`.
- Helpers and derived values are copied into the chunks that read them.

### Item template chunks

One per `<For>`, `list=<id>`, loaded only to insert rows. It exports `render(scope)`, which returns one row's HTML without the row comments, with `scope.rows` ending in the new row. It exports `namespace` when the list is inside `<svg>` or `<math>`.

### Patching

- `Page.root` is the parent node of the state script. Bindings outside rows are looked up under it.
- `patch(page, prev, next)` finds the changed groups with `diffPaths`, loads their chunks by the covers rule, runs the chosen `a`, `t` and `c` bindings outside rows, and calls `patchList` for each chosen `l` binding outside rows. The loader awaits it before the next queued message, and patches once after a run of queued messages.
- The bindings one patch runs are the exports of the chunks of its changed groups, own and covered. A chunk loaded by an earlier patch counts the same as a new one: its bindings run again when its group changed or is covered by a changed group, and not otherwise. Within one patch each binding runs at most once, deduplicated by export name, since covered bindings appear in several chunks.
- `diffPaths(prev, next, paths, keys)` compares by reference along each path. `keys` maps the `path` of each keyed `<For>` in `manifest.lists` to its `key`.
- A `*` pairs items by index or field, and an item on one side only is a change. Under a keyed list the path also changes when it differs by key: a key in both lists compares the two items. So a `*` path under a keyed list changes when it differs by key or by index. Root props never change, so `props` paths are skipped until `nesting`.
- Why both: a row binding needs key pairing. `[a1 {done: false}, a2 {done: true}]` to `[a2 {done: false}, a1 {done: true}]` reads `[false, true]` by index on both sides, so an index diff alone reports no change and the moved rows keep stale checkboxes. A hole outside the rows needs index pairing: `{todos[selected].done ? 'yes' : 'no'}` has the paths `selected, todos.*.done`, and after the same reorder with `selected` at 0 nothing changed by key, but index 0 now reads a2.
- Cost: a reorder, an add or a remove may load row binding chunks that a key diff alone would skip. Toggling one todo changes `done` both by key and by index, so the first click still loads only `binding=todos.*.done`.
- `patchList` matches old and new rows by `key`, renders inserted rows with the item template chunk, moves and removes rows, and runs `context.bindings` on kept rows whose item changed, with the row scope. A row binding whose group was chosen by this patch runs on every kept row of its list, whether or not the row's item changed, because its paths may include state outside the list (`class={selected === t.id}`). To make that possible without another request, a binding chunk also exports the `l` of every list that holds one of its row bindings, and of the enclosing lists up to the outermost, the way it exports covered bindings. `patch()` calls `patchList` for each list that has a chosen row binding or a chosen `l` binding, and `ListContext.bindings` holds all chosen bindings of the list and of its nested lists; `patchList` filters them by each entry's `bindings`.
- Nested lists: an inner `<For>`'s `l` export is a row binding of the outer list, so it is in the outer list's `bindings` and in `ListContext.bindings`. For a kept outer row whose item changed, `patchList` calls the inner `l` on the row's old and new scopes and calls itself on the inner list's start comment in that row, with a context whose `list` is `manifest.lists[innerId]`, whose scopes are the row scopes, and whose `bindings` are the chosen bindings named in that entry's `bindings`.
- `onBlock(add, remove)`: `setBranch` and `patchList` call the hooks when they add or remove a block. Children are removed before parents. `patch()` does not await what is registered. `commands-subs` registers subscription start and stop, `document-head` head blocks, and `errors` `<Try>` region swaps.
- Bindings are idempotent: running one whose paths did not change writes the same value.

### Compiler API

```ts
compile(source: string, id: string): {
  server: string;          // server module code
  client: Module[];        // { chunk, code }, one per chunk in the manifest
  manifest: Manifest;
  diagnostics: CompileDiagnostic[];
}
```

`id` is the root-relative Vite id, such as `/src/todo.idlip.tsx`, and becomes `manifest.module`. With an error diagnostic, `server` is empty and `client` is `[]`. All code is plain `.js` with no types, so Vite's loader order does not matter (`spike-chunk-split` outcome, Gotchas).

### HTML parser rules

The client finds nodes by attribute and comment, so the markup must parse into the tree the compiler wrote. The parser keeps comments anywhere in the body, including in tables and `<select>`. What it rewrites:

| Nesting                                                                                                                                                                                                             | Decision                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A block element inside `<p>`, a heading in a heading, `<li>` in `<li>`, `<dt>` or `<dd>` in either, `<a>` in `<a>`, `<form>` in `<form>`, `<button>` in `<button>`, a wrong child of `<table>`, a section or `<tr>` | Rejected, `html-nesting`. The rules are in `nodes/spike-view-analysis/prototype/nesting.ts`.                                                                                                  |
| Text or a text hole directly in `<table>`, `<thead>`, `<tbody>`, `<tfoot>` or `<tr>`                                                                                                                                | Rejected, `html-nesting`. The parser moves text out of the table.                                                                                                                             |
| `<tr>`, `<td>` or `<col>` where the parser inserts `<tbody>`, `<tr>` or `<colgroup>`                                                                                                                                | Rejected, `html-implied`.                                                                                                                                                                     |
| `<li>` outside a list                                                                                                                                                                                               | Kept. The parser does not rewrite it.                                                                                                                                                         |
| A hole in `<textarea>` or `<title>`                                                                                                                                                                                 | Must be the whole content. The element gets the id in `i-a` and no comments, its `t` binding receives the element, and the client sets its text. Other content next to it is `html-raw-text`. |
| A hole in `<script>` or `<style>`                                                                                                                                                                                   | Rejected, `html-raw-text`.                                                                                                                                                                    |
| Rows and branches with `<tr>`, `<td>`, `<option>` or `<li>`                                                                                                                                                         | Kept. Client templates parse in a `<template>`, which accepts them.                                                                                                                           |

These checks apply across block boundaries: a `<For>` inside `<tbody>` whose row is text is rejected the same way.

### Reserved

- Nested components: a component boundary marker that carries the component's model path, and the path on each queued message, kept apart from the tag. `nesting` defines both. Until then a message has no path.
- A ref marker attribute `i-ref` on elements with `ref`, scoped by component path (`dom-refs`).
- A raw HTML binding, export `h<id>`, that sets `innerHTML` from a `TrustedHtml` value (`svg-and-html`).
- Boundary markers around each `<Try>` region and the `fallback` manifest field (`errors`).
- Head block markers and the title rule, last title wins (`document-head`).
- A subscription marker `<template i-sub="<chunk>">` with the serialized input, per active `<Subscribe>`. The loader starts the sources whose markers are in the page (`commands-subs`).
- The `$form` placeholder (`form-fields`).

## Stub

The golden fixtures are the stub for both sides. Each of `test/fixtures/counter/` and `test/fixtures/todo/` has:

- `<name>.idlip.tsx`: the source. The counter is the one of `spike-view-analysis`. The todo is the 0002 example without `await` (ids come from a `next` counter, `persist` waits for `custom-effects`), with a form submit with `prevent` and an input with the key filter `Escape`.
- `input.json`: the module id (`/src/todo.idlip.tsx`), the source file name, and the props to render.
- `expected/server.js`, `expected/manifest.json`, `expected/page.html` (the `render()` output for the props), and `expected/client/<file>` for each chunk.

`test/fixtures/reference.ts` holds reference versions of `text`, `attr`, `on`, the state script writer, `diffPaths` and the covers walk. The fixture test renders `server.js` with them and compares the page.

## Contract tests

`packages/idlip/test/fixtures/fixtures.test.ts`, run with `pnpm --filter idlip exec vitest run test/fixtures`. For each fixture it checks that every file parses, the manifest's shape, that the server module exports the manifest, one file per chunk, the exports of each chunk against the manifest and the covers rule, that the server module renders `page.html`, that list rows rendered from the item template match the page, and that every binding's node is in the page, and that the server module maps every chunk id to its URL. It also runs the handler chunks, checks with a reference `diffPaths` and covers walk that the first toggle loads only `binding=todos.*.done`, and checks that a keyed reorder that moves `done` counts as a change.

## Changes

- v9 (2026-11-21, from the `compile-view-codegen` review): groups are ordered topologically by covers; a chosen row binding runs on every kept row.
- v9 (2026-11-21, from the `compile-update` review): the payload puts props values before the arguments, so a rest parameter stays last, and includes the props paths of called handlers.
- v8 (frozen by `compiled-format`): fixes the DOM encoding (binding ids, `i-a`, comment pairs, rows without keys), event JSON with placeholders and modifiers, key filters, the authoring forms for `prevent`, `stop` and key filters, the state script as a lazy seroval record, the head listener and the queue hand-off, the budgets (listener 1024 B, loader 4096 B gzip), the manifest with groups, covers and lists, chunk ids and the chunk URL map in the state record, key and index pairing in `diffPaths`, the module shapes, the render and patch helpers, the runtime seam types, the compiler API and the HTML parser rules. `patch` takes `(page, prev, next)` instead of `(root, oldModel, newModel, manifest)`, since it also needs the props and the chunk loader. Adds the counter and todo fixtures.
- v7: block hook `onBlock`, `latest:` event attributes, `<window>` and `<document>` listeners, and the `<Subscribe>` marker with source chunk id and input. Source: `docs/roadmaps/core/debates/subscriptions/debate.md`, 2026-11-21.
- v6: function components replace `defineModule`. Tags are handler names and payloads are argument arrays. Continuation chunks and tags for `await`. `runTask` replaces `runCmd` and `startSubs`. Subscriptions become markers in the page instead of a list in the state script. One chunk per handler, with its continuations. Source: `docs/proposals/0002-modules.md` and `docs/proposals/0004-effects-refs-errors.md`, revised 2026-11-21.
- v5: SVG and MathML namespaces, and reserved ref markers, raw HTML bindings, effect and fallback manifest fields and boundary markers. Source: `docs/proposals/0004-effects-refs-errors.md`.
- v4: adds the state encoding budget, early events, event modifiers, HTML parser rules, placeholder timing and CSP nonces. Source: runtime gap review against brumate, 2026-11-20.
- v3: reserves the manifest fields `writes`, `bindings` and `ops`, keyed path segments and the `$form` placeholder. Source: `docs/proposals/0003-update-analysis.md`.
- v2: message path instead of leading tags, `*.idlip.tsx` default export modules, room for `dynamic` path sets in the state script. Source: `docs/proposals/0002-modules.md`.
- v1: initial draft.
