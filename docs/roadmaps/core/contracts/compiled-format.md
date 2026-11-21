---
name: compiled-format
version: 13
status: frozen
defined_by: compiled-format
---

# Contract: compiled-format

## Purpose

The seam between the compiler (`compile-update`, `compile-view-codegen`, `compile-integration`, `vite-plugin`) and the runtime (`ssr-render`, `resume-loader`, `patch-bindings`, `patch-lists`). Both sides test against the golden fixtures in `packages/idlip/test/fixtures/`. The types are in `packages/idlip/src/core/format.ts`. This text says what each one means.

## Interface

`src/core/format.ts` exports:

| Type or function                                                                 | What it is                                                |
| -------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `Message`                                                                        | `{ t, p }`: a tag and the payload array.                  |
| `DomMessage`, `Placeholder`                                                      | The JSON in an `on:<event>` attribute.                    |
| `Model`, `Props`                                                                 | State fields by name, props by name.                      |
| `Manifest`, `HandlerEntry`, `BindingGroup`, `ListEntry`                          | The manifest of one module.                               |
| `PageState`, `ChunkUrls`, `StateRecord`, `QueuedEvent`, `Boot`                   | The state script, the listener's queue and `self.$idlip`. |
| `RenderContext`, `ServerRender`, `ServerModule`                                  | The compiled server module.                               |
| `Scope`, `Row`, `NodeBinding`, `ListBinding`, `Binding`                          | What client chunks read and export.                       |
| `Update`, `Step`, `After`, `Task`, `Outcome`                                     | Handler exports and the async seam.                       |
| `Slot`, `ViewChunk`, `PropBinding`                                               | Nested components (see Nested components).                |
| `HandlerChunk`, `BindingChunk`, `ListChunk`                                      | The three client chunk shapes.                            |
| `LoadChunk`, `Page`, `Patch`, `DiffPaths`, `ListContext`, `PatchList`, `OnBlock` | Runtime seams.                                            |
| `Module`, `CompileDiagnostic`, `CompileResult`, `Compile`                        | The compiler API.                                         |
| `getChunkFile(chunk)`, `getChunkId(module, chunk)`                               | File name and Vite module id of a chunk.                  |

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
type Compile = (source: string, id: string, options?: { child?: boolean }) => CompileResult; // idlip/compiler
```

## Behavior

### Binding ids

Every place the client patches has a binding id, a number unique within the component:

- The hole ids of `contracts/view-ir.md`, in view order.
- Then one id per event whose payload changes: an event with `paths`, or whose handler reads a props path of a child component. Root props never change, so the root's events need none. Ids continue after the last hole id, in view order. In the todo, `on:click={() => toggle(t.id)}` gets id 7 after holes 0 to 6.

A binding's export name is its kind and its id: `a<id>` for an element binding (attribute, property, class, event payload, a `<Head>` element, a `<Subscribe>` key, or the content of an element with `html={trusted(value)}`), `t<id>` for a text hole, `c<id>` for a condition block, `l<id>` for a `<For>` block, `p<id>` for a prop passed to a child (it has no node).

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
- **Placeholders.** A top-level payload item that is an array whose first item is a string starting with `$` is a placeholder. `["$event", ...segments]` reads the segments from the event when it fires. The segment `currentTarget` is the element that carries the attribute, since the delegated listener's `currentTarget` is the document. `["$", ...items]` is a literal array whose first item starts with `$`: the compiler writes such a literal argument that way, and the listener drops the `$`. Items below the top level are never placeholders.
- An event argument that reads the event must be a whole argument that is a path on the event, such as `e.currentTarget.value`. Any other use of the event in an argument is `event-placeholder`, and a computed segment is `event-computed-key`.
- The listener resolves placeholders synchronously when the event fires, not when the chunk arrives. Queued `input` events keep the value each one had.
- One element has at most one handler per event name.
- **Form fields.** A field is an ordinary `$event` path: `on:submit={(e) => add(e.currentTarget.elements.draft.value)}` writes `["$event","currentTarget","elements","draft","value"]`, since `HTMLFormControlsCollection` answers a name lookup as a property. The listener is unchanged (no `HAS_FORM` flag, 0 B). Only `elements.<name>.value`, `.checked` and `.valueAsNumber` are documented, and any property path on the event is accepted. The compiler adds `prevent` to every element `on:submit` that is an arrow or a handler of this module and lacks it, since no source form gives `passive`. A forwarded message prop (`on:submit={props.onSend}`) keeps the parent's modifiers.
- **Message props.** A callback prop is a `DomMessage` with an owner as item 3: `["remove",["a1"],"",""]`. The owner is the absolute model path of the component that owns the handler (`''` is the root). A message with item 3 is dispatched to that path, one without it to the path of the boundary around its target. "Set" means `!== undefined`, never truthiness. The listener copies item 3 into `QueuedEvent.owner`. Item 2 may be `''`.

### Modifiers

| Modifier       | Meaning                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `prevent`      | The listener calls `preventDefault()` when the event fires.                                                                                      |
| `stop`         | The listener calls `stopImmediatePropagation()` and does not look at outer elements for the same event.                                          |
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

- `<window>` and `<document>` render `<template i-global="window" on:keydown='…'></template>` at their position in the view. The listener adds those listeners on `window` or `document`, and finds the messages in the templates. The type is listed as `<type>:window` or `<type>:document` in `manifest.events` and in the record, even when the element sits in a condition, and the listener adds the window or document listener at record time, so a global element that a patch inserts later is heard. A global event is never passive: its token has no `:passive` suffix.
- Other events use one listener per event type on `document`, in the bubble phase. It walks from the target outwards and takes the first element with `on:<type>`, unless `stop` ends the walk earlier.
- The listener adds a capture-phase and a bubble-phase document listener per event type and handles each event in one of them by `event.bubbles`. An event that does not bubble (`focus`, `mouseenter`, media events, a `CustomEvent` without `bubbles`) is matched only on `event.target`, with no outward walk. A walk would fire an ancestor's `on:focus` when a child takes focus. Choosing by `event.bubbles` instead of a fixed list covers every type, custom events included (from the `resume-loader` review).
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
- `chunks` is the chunk URL map (see Chunk URLs) for the modules rendered on the page, and only those. The `view` chunk of a module in `modules` is left out, since a template chunk imports it by id.
- `model` is the component's state fields. `props` holds only the props fields that some binding reads. Handlers get the props they read through the payload. Both fixtures have `props: {}`.
- With a `nonce` render option, the script is `<script i-state nonce="…">`.
- `PageState` also holds `slots`, `dynamic` (Dynamic holes) and `modules` (Nested components). Each is absent when the page has none, so a page without children or dynamic holes does not change. The key order is `manifest, chunks, model, props, slots, dynamic, modules`.
- The server serializes the parts that do not change between requests (the root manifest, `chunks` and `modules` of the root's `uses` closure) once per root module and reuses them; each render serializes only `model`, `props`, `slots` and `dynamic`. When seroval would write function form, it falls back to one call for the whole state. A child rendered outside the root's `uses` closure is serialized for that render only.
- `i-build="<id>"` on the state script is the build id (Build id). It is not part of the state value.

### Listener and early events

- The listener is a small inline script that the host page puts in `<head>`, so events that fire before the loader module runs are kept. `idlip/server` exports it as `renderListener({ nonce })`, which returns the script tag (`contracts/core-api.change-request.md`, core-api v9). `resume-loader` implements it. It is not part of `render()` output, so the fixture HTML does not depend on runtime code.
- `self.$idlip` is a `Boot`: an array of state records with a queue `q`. The listener replaces `push`, so it adds the listeners of each record's event types as soon as the record is pushed, and adds those of records pushed before it ran.
- On an event, the listener finds the element, applies the key filter and the modifiers synchronously, resolves placeholders, and pushes a `QueuedEvent` to `q`.
- The loader takes over `q`: it handles the queued events in order and replaces `q.push`, so later events go straight to it. Taking over an array by draining it and replacing its `push` is the one hand-off rule for both arrays.
- Budgets, checked by `e2e-harness` on the production build with `gzip -9`: the listener script at most 1024 B gzip, the loader module with its static imports at most 4096 B gzip for the loader with no optional features (see Runtime feature flags), measured fully minified (rolldown `minify: true`). Chunks are not counted. The loader's static graph includes `idlip/client` with `patch`, `patchList`, `diffPaths`, `parseHtml` and the block hooks. The DOM and render helpers (`setAttr`, `setText`, `setOn`, `setBranch`, `attr`, `on`, `text`) are not in the loader: the compiler copies the ones a chunk uses into that chunk, from one source, the way it copies module helpers. A chunk may import from `idlip/client` only what the loader already holds, so the first click costs no third request. Why: with the helpers in the loader, the measured loader was 4877 B gzip, 781 B over budget.

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

- `handlers`: every message tag to its chunk. Continuation tags (`add$1`) have their own entries with their handler's chunk, so the loader never parses a tag. `writes` and `bindings` on an entry are described below. Reserved for `update-ops`: an entry with `ops` instead of `chunk`.
- **Write sets.** `handlers[tag].writes` lists the model paths the handler can change (`todos.*.done`). Continuation tags carry the write set of their whole handler. `bindings` lists the group keys the loader starts with the handler chunk: the groups with a path that meets a write, minus every group that another listed group covers. Both are absent when the analysis cannot read a write. Two paths meet when one is a prefix of the other, segment by segment; `*` matches any item and a keyed segment `name[field=source]` counts as `name.*` (`meetsPath` in `compiler/update/writes.ts`, compiler only). A write to a state `let` is its field name. `x = x.map((t) => (<test> ? { ...t, f: <e> } : t))` is `x.*.f` for each field `f` set after the spread. Any other write to `x` is `x`. The set is the union over the handler and the handlers it calls, an upper bound. In-place changes (`todos.push(...)`, `todos[0].done = true`, `cfg.n++`, `delete`) and writes the analysis cannot read leave `writes` out. On an event the loader starts the handler chunk and the chunks of `bindings` together. A binding chunk that fails there is asked again by the patch through `page.load`. `Patch` still diffs every group path.
- `groups`: one per distinct path set among the bindings. The key is the paths joined by `,`. `bindings` lists the export names of the group's own bindings.
- `lists`: each `<For>` by binding id, written as a string key. An entry has the `key` prop, `path` (the path of `each` when it is a path, such as `todos` or `columns.*.cards`; absent for a helper call), the item template chunk, and the bindings directly inside a row. A nested list also has `parent`, the id of the enclosing list as a string.
- Chunk names: `handler=<tag>`, `binding=<group key>`, `list=<id>`, `task=<site>`, `source=<name>`, `try=<id>`, `view`. The file name is `getChunkFile(chunk)`: the first `=` becomes `.`. In the rest, `*` becomes `_`, `,` becomes `+`, `[` becomes `(`, `]` becomes `)` and `=` becomes `~`, so `binding=todos.*.done` is `binding.todos._.done.js` and `binding=todos[id=selected].text` is `binding.todos(id~selected).text.js`. The fixtures and the `name` of an emitted chunk use it. Chunk ids (`getChunkId`) keep the raw chunk name.
- Path sets use `*` for list items. A keyed segment is `name[field=source]`: `name` is read from the value reached so far, and `source` is a model path read from the root of each model, such as `todos[id=selected].text`. `diffPaths` finds the item whose `field` equals the source value in `prev` and in `next`, and compares the rest of the path on the two items. An item found on one side only is a change, an item missing on both sides is not, and a reorder is not a change. Paths split at dots outside brackets, so a source may contain dots. `$p` sources are reserved for `keyed-writes`.
- `tasks`: the continuation tag (`persist$1`) of each awaited call to its chunk. It is absent when no handler awaits. For an import or a module function the value is `task=<site>`. For a built-in site (`Random.id`, `Random.number`, `Time.now`, `Time.sleep`, imported from `idlip`) the value is the handler chunk, `handler=<name>`, which exports `task$<site>(...args)` (`task$add$1`), so built-ins load nothing extra. The loader treats the `handler=` prefix as built-in.
- `listens?`: event type to the sorted handler names the view dispatches on it (`{ click: ['toggle'] }`). A message prop adds no name, its handler belongs to the parent. Absent when no element dispatches a handler. `renderPreload` reads it.
- `after?: true`: a handler returns `after` calls (Refs).
- `sources?`, `fallback?`, `head?`, `view?`: see Subscriptions, Error regions, Head and Nested components.
- `groups` may hold the group `$dynamic` (Dynamic holes).

### Runtime feature flags

Loader code that only some apps use sits behind a `HAS_*` constant from `src/client/features.ts` (`HAS_TASKS`, `HAS_KEYED`, `HAS_REFS`, `HAS_CHILDREN`, `HAS_SUBS`, `HAS_HEAD`, `HAS_ERRORS`, `HAS_RETRY`, `HAS_SKEW`, `HAS_DYNAMIC`). Each is `typeof __IDLIP_HAS_X__ === 'undefined' || __IDLIP_HAS_X__`, so every flag is on without the Vite plugin (tests, `idlip/testing`, dev). In a client build the plugin compiles every module in `buildStart`, unions the features its detectors report (`src/vite/features.ts`: `TASKS` when a manifest has `tasks`, `KEYED` when a group path has a `[` segment, `REFS` when it has `after`, `CHILDREN` when a module is a child or has `uses`, `SUBS` when it has `sources`, `HEAD` when it has `head`, `ERRORS` and `RETRY` when it has `fallback`, `DYNAMIC` when it has the `$dynamic` group) and replaces the globals with literals, so the bundler folds the dead branch. A component outside the plugin's `modules` globs that needs a flag that is off fails the build and the error names the file and the flag. The 4096 B budget is the loader with no optional features. `HAS_SKEW` is the exception: the plugin option `skew` (default on) sets it, not a detector. `HAS_RETRY` may be on without `<Try>` once `skew` needs it. Each feature's cost is reported by `e2e-harness` or a test, not capped; the costs of the later flags are in `reviews/wave-9.md`. The first two: tasks +274 B, keyed paths +124 B (measured on the `effects` and `keyed` fixtures). `HAS_KEYED` gates only the keyed segment; the pairing of `*` items by key under a keyed `<For>` stays on. A new flag takes one `declare const` and export in `features.ts`, one line in `DETECTORS`, and an `if (HAS_NAME)` around the loader code.

### Chunk URLs

- `manifest.module` is the module's root-relative Vite id, such as `/src/todo.idlip.tsx`. `compile(source, id)` takes it as `id`.
- A chunk id is `getChunkId(module, chunk)`: `<module>?idlip-<chunk>&lang.js`, so `/src/todo.idlip.tsx?idlip-handler=toggle&lang.js`, `?idlip-binding=todos.*.done&lang.js` and `?idlip-list=3&lang.js`. This is the scheme of `spike-chunk-split`, with the chunk kinds above. The id ends in `&lang.js` because Vite reads the loader from the end of the id, and binding names contain dots.
- `ChunkUrls` maps chunk id to URL. `vite-plugin` produces it. In dev the id is the URL. In a build the URL comes from the client build's manifest.
- The chunk map has one extra key, `build` (Build id), which `render()` moves out of `chunks` into `i-build`.
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

- A module that renders stateful children also exports `uses`, the server modules it can render (`import * as Counter from '<specifier of the source>'`; Vite resolves it). The default export takes a fourth parameter `path` (`''` for the root) and calls `context.state(state, path)`; `ComponentState`, `ModuleInfo` and `NestedContext` live in `server/render.ts`, not in `format.ts`.
- The default export is a `ServerRender`, `Component(props, context, model?)`: it computes the initial state from props, or takes `model` when given (`idlip/testing` re-renders from a model after each message), calls `context.state({ manifest, chunks, model, props })` once, and returns the markup. `render()` from `idlip/server` calls it, then writes the state script. Derived values are inlined, and module-level helpers are copied as they are.
- Static markup is string literals. Constant event attributes are literals. A render-time payload uses `on(event, message)`.
- The `manifest` export equals the `manifest` of `compile()`.

### Render helpers

`idlip/server` exports these. Client chunks carry their own copies from the same source (see Budgets).

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
- Async handlers, implemented by `custom-effects`: a segment that ends at an `await` returns `{ model, task }`. `task.site` is the continuation tag (`persist$1`, unique per handler, no `:`) and a key of `manifest.tasks`. `task.then` has the same value. `task.args` are the call arguments and `task.carried` lists the locals of `segments[n].carried` in order, then the props values (`props$step`) that the continuation or a later one reads, in the order of the handler's payload. The continuation's payload is `[outcome, ...carried]`, where `outcome` is `{ ok: true, value }` or `{ ok: false, error }`. A rejected task outside a `try` arrives as `{ ok: false, error }`, and the continuation throws it as its first statement, so the loader reports it. A continuation tag has a `manifest.handlers` entry whose `chunk` is the handler's own chunk (`handler=add`), not `handler=add$1`. All segments share the handler's chunk.
- A task chunk, `task=<site>`, exports `run(...args)`, which calls the awaited function and returns its promise. It copies the import, or the module-level function with the helpers it reaches. `vite/chunks.ts` accepts the `task` kind and `listChunks` includes the chunks of `manifest.tasks`.
- `runTask(host, task)` (`src/client/tasks/run.ts`) takes a host object (`page`, `apply`, `push`, `report`). A site in `manifest.tasks` with a `task=` chunk loads it, calls `run`, and when the task settles pushes the continuation to `boot.q` as an event with no DOM target, so it joins the next batch. The batch does not wait for it, and every run continues (no latest-wins). A built-in site (`handler=` value) runs `task$<site>` from the handler chunk inside the current batch, so one patch covers the step and its continuation. A chunk that fails to load rejects, the loader reports it and keeps the step's model.

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
- A `*` pairs items by index or field, and an item on one side only is a change. Under a keyed list the path also changes when it differs by key: a key in both lists compares the two items. So a `*` path under a keyed list changes when it differs by key or by index. `props` paths read from `{ ...model, props }`: a child's `props.label` group changes when its parent passes a new value, and the root's props never change, so the same code skips them.
- Why both: a row binding needs key pairing. `[a1 {done: false}, a2 {done: true}]` to `[a2 {done: false}, a1 {done: true}]` reads `[false, true]` by index on both sides, so an index diff alone reports no change and the moved rows keep stale checkboxes. A hole outside the rows needs index pairing: `{todos[selected].done ? 'yes' : 'no'}` has the paths `selected, todos.*.done`, and after the same reorder with `selected` at 0 nothing changed by key, but index 0 now reads a2.
- Cost: a reorder, an add or a remove may load row binding chunks that a key diff alone would skip. Toggling one todo changes `done` both by key and by index, so the first click still loads only `binding=todos.*.done`.
- `patchList` matches old and new rows by `key`, renders inserted rows with the item template chunk, moves and removes rows, and runs `context.bindings` on kept rows whose item changed, with the row scope. A row binding whose group was chosen by this patch runs on every kept row of its list, whether or not the row's item changed, because its paths may include state outside the list (`class={selected === t.id}`). To make that possible without another request, a binding chunk also exports the `l` of every list that holds one of its row bindings, and of the enclosing lists up to the outermost, the way it exports covered bindings. `patch()` calls `patchList` for each list that has a chosen row binding or a chosen `l` binding, and `ListContext.bindings` holds all chosen bindings of the list and of its nested lists; `patchList` filters them by each entry's `bindings`.
- Nested lists: an inner `<For>`'s `l` export is a row binding of the outer list, so it is in the outer list's `bindings` and in `ListContext.bindings`. For a kept outer row whose item changed, `patchList` calls the inner `l` on the row's old and new scopes and calls itself on the inner list's start comment in that row, with a context whose `list` is `manifest.lists[innerId]`, whose scopes are the row scopes, and whose `bindings` are the same `ListContext.bindings` passed through unchanged (all chosen bindings of the list and its nested lists, at any depth); `patchList` filters them by each entry's `bindings`. An enclosing `l` that a chunk exports only because it holds a nested row binding counts as chosen, so `patchList` recurses into it. A nested `l` whose start comment was detached by an earlier binding in the same row (a `c` that swapped its branch) is skipped, since the new branch already matches `next`.
- `onBlock(add, remove)`: `setBranch` and `patchList` call the hooks when they add or remove a block. Children are removed before parents. `patch()` does not await what is registered. `commands-subs` registers subscription start and stop, `document-head` head blocks, `nesting` the slot lifecycle.
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

| Nesting                                                                                                                                                                                                             | Decision                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A block element inside `<p>`, a heading in a heading, `<li>` in `<li>`, `<dt>` or `<dd>` in either, `<a>` in `<a>`, `<form>` in `<form>`, `<button>` in `<button>`, a wrong child of `<table>`, a section or `<tr>` | Rejected, `html-nesting`. The rules are in `nodes/spike-view-analysis/prototype/nesting.ts`.                                                                                                                                                           |
| Text or a text hole directly in `<table>`, `<thead>`, `<tbody>`, `<tfoot>` or `<tr>`                                                                                                                                | Rejected, `html-nesting`. The parser moves text out of the table.                                                                                                                                                                                      |
| `<tr>`, `<td>` or `<col>` where the parser inserts `<tbody>`, `<tr>` or `<colgroup>`                                                                                                                                | Rejected, `html-implied`.                                                                                                                                                                                                                              |
| `<li>` outside a list                                                                                                                                                                                               | Kept. The parser does not rewrite it.                                                                                                                                                                                                                  |
| A hole in `<textarea>` or `<title>`                                                                                                                                                                                 | Must be the whole content. The element gets the id in `i-a` and no comments, its `t` binding receives the element, and the client sets its text (a `<title>` in a `<Head>` is one `a` binding, see Head). Other content next to it is `html-raw-text`. |
| A hole in `<script>` or `<style>`                                                                                                                                                                                   | Rejected, `html-raw-text`.                                                                                                                                                                                                                             |
| Rows and branches with `<tr>`, `<td>`, `<option>` or `<li>`                                                                                                                                                         | Kept. Client templates parse in a `<template>`, which accepts them.                                                                                                                                                                                    |

These checks apply across block boundaries: a `<For>` inside `<tbody>` whose row is text is rejected the same way.

### Handler results and refs

- `Step` is `{ $step?: true, model, task?, after? }`. The loader tests `'$step' in result`, so a model with a field named `model` or `task` is not read as a step. The compiler emits `$step: true` on every step with a task or `after`. (The nested-components proposal made `$step` required and added `Step.send` for a handler that calls a message prop. Neither landed: `$step` is optional and there is no `send`.)
- An element with a `ref` carries `i-ref="<name>"`, or `i-ref="<name> <key>"` for a tuple ref in a `<For>` row (`ref={['row', t.id]}` gives `i-ref="row a1"`), after the events and before `i-a`. The key is the row's `<For>` key, so the attribute never patches and takes no binding id. The server and the item template write it alike.
- `after?: readonly After[]` with `After = { call: 'focus' | 'scrollIntoView' | 'reset', args: [RefName] }`. A handler that calls `Dom.focus`, `Dom.scrollIntoView` or `Dom.reset` as a statement pushes the call to a local `$after` array and returns `{ $step: true, model, after }`. The loader collects `after` of every step of a batch and runs the calls once, in order, after the batch's patch, under `Page.root`. A name with no element warns `idlip: no ref <name>` and does nothing. `manifest.after` is `true` when any handler has after calls (`HAS_REFS`).
- `Dom.measure` is a built-in task site (`manifest.tasks[site] = handler=<name>`, `task$<site>(ref)`). It reads the element from `document` and resolves to a plain `{ x, y, width, height }`, or `null` with a warning. `runTask` calls a task with `this` set to `Page.root`.

### Nested components

A stateful child has a boundary, a slot in the state script and a `view` chunk. The golden fixtures `test/fixtures/nested/board/` and `nested/counter/` show every part.

- **Types.** `Slot { module, model, props }`; `PageState.slots` (rendered children by path) and `PageState.modules: Record<string, ChildManifest>` (manifests of the child modules and of what they can render, the `uses` closure, including a child whose list is empty at render; a `ChildManifest` is a `Manifest` without `events`, `listens`, `view` and the `writes` of each handler, and the loader fills `events: []` where it needs a `Manifest`); `Manifest.view?: { chunk: 'view' }`, present when a project module renders the module as a child (`compile` option `{ child: true }`); `Scope.path` (absent is the root); `PropBinding`; `ViewChunk { init(props): Model; render(scope): string }`; `QueuedEvent.owner`; `Page.path` and `Page.start`.
- **Boundary.** `<!--n:<path>-->…<!--/n-->`. The root has no boundary and the path `''`. `path = slot ('/' slot)*`, one slot per component level, outermost first. `slot = <site>[':' <key>]*`. `site` is the index of the child among the `child` nodes of the component's view, in source order, from 0, unaffected by conditions and loops. A `key` part is `String(value)` through `encodeURIComponent` with `-` written `%2D`, so a path never holds `/`, `:`, `-` or `>`. The keys are an explicit `key` prop, then the loop key of every enclosing `<For>`, outermost first (always present inside a `<For>`). Examples: `0`, `1:a1`, `1:a1/0`. `slot(path, site, ...keys)` from `idlip/server` builds it. A row holds the boundary: `<!--i--><!--n:1:a1-->…<!--/n--><!--/i-->`. The boundary is a block for `onBlock`, children removed before parents.
- **Lookups stay in one component.** Binding ids restart in each module. A component's bindings are found between its own boundary comments, and the search never enters a nested boundary.
- **Ids.** A prop value is a hole and takes a hole id in view order. A message prop whose arguments read model paths takes the next event id. A prop hole or message prop with an empty path set exports nothing.
- **State script.** `slots` has one entry per rendered boundary; its `props` holds the props fields a binding of the child reads. The event types of the record are the union of the root's and of `modules`. `manifest.events` stays the module's own list. A child's state is not a field of the parent's model.
- **Server.** A child call is `Counter.default(props, context, context.slots?.[p]?.model, p)` with `p = slot(path, site, ...keys)`, wrapped in the boundary. `render()` takes the root's `context.state` call, turns the calls with a path into `slots` and merges `chunks`, `modules` and event types. A stateless component is inlined and has no boundary.
- **Target.** The loader takes the path from `event.owner` when set, else from the nearest boundary around `event.target` (count `<!--/n-->` and `<!--n:…-->` pairs among previous siblings, then the parent). `update(slot.model, payload)` gives the next model, which replaces the slot's, and the patch runs on the slot with its manifest, props and boundary as lookup root.
- **Props.** A parent's `p<id>(scope)` calls `setProp(path, name, value)`, which compares by value (a message prop is a new array on each run), does nothing unless the entry is live, and marks the slot. After the parent's patch the loader patches each marked slot, parents first, with its old and new props, so only its `props.*` groups run.
- **Slot lifecycle.** Each path has one entry, `live` or `removed`, with a generation. State script slots start `live`, gen 0. `addChild` sets `live` with gen + 1 (0 for a new path). The remove hook sets `removed` and keeps the gen. A path with no entry is `removed`. Only the block hooks change the kind. A message to a path that is not live is dropped. A task records `(path, gen)` and its continuation runs only if the entry is live with the same gen. A child's model is not kept after its block is removed.
- **Adding.** A list template or branch render calls `addChild(path, module, view, props)` from `idlip/client`: it runs `view.init(props)`, records the slot and returns the boundary and `view.render(...)`. The template chunk imports the child's `view` chunk (`<module>?idlip-view&lang.js`, file `view.js`) statically.
- **Reorder.** A move keeps the slot. Only a key that leaves the list is removed and only an inserted key calls `addChild`. `key` on a stateful child is optional. A child with no `key` outside a loop is slotted by position, and moving it in the source is a new slot.
- **Loader shape.** All of it lives in `src/client/nesting.ts` behind `HAS_CHILDREN` (`addChild`, `setProp`, `installNesting`). With the flag off the module, the `n:` marker match and the `owner` copy leave the build.
- Not done: `Step.send` (a handler that forwards a message prop to its owner), and the compile error `let-reserved` for state fields that start with `$`.

### Error regions

A `<Try>` renders as `<!--e<id>:<state>-->…<!--/e-->`. `<id>` counts regions in view order from 0 on its own counter. `<state>` is `0` (body rendered) or `1` (catch view rendered). A region nests like any block. The loader finds a region by walking up from a failed node to the nearest `e` comment, never past an `n:` boundary, and flips the digit when it swaps.

- **Manifest.** `fallback?: Record<string, string>`: region id to chunk `try=<id>` (file `try.<id>.js`, id `<module>?idlip-try=<id>&lang.js`, listed by `listChunks` and the server `chunks` map). `HAS_ERRORS` and `HAS_RETRY` are on when `fallback` exists.
- **Chunk.** Exports `render(error, scope)`, the catch view as HTML without region markers, and, when the catch view uses `reset`, `region(scope, start)`: the whole region with markers, built as the server builds it. `scope` is `{ model, props, rows, path }`. `error` is the string `error instanceof Error ? error.name + ': ' + error.message : String(error)`, with no stack, and the server renders the same string. The catch view is rendered once and not patched. A `<For>`, child component, `<Subscribe>` or `<Try>` in it is `try-catch-node`.
- **Reset.** `reset` is an event target: `on:click='["$reset",[<id>]]'`. `$reset` has no `handlers` entry and no chunk. The runtime resolves the region from the clicked element, calls `region(...)` with the current model and replaces the region. If the body throws again the result is state `1` with the new error. A region in a `<For>` reads its rows in the chunk with `getRows$(start, model, lists$)`, from the `each` path of each list; a list whose `each` is not a path cannot be reset and reports an error. The loader passes `rows: []`. The event name is listed in `manifest.events`.
- **Body.** The body keeps its bindings. A binding that throws swaps the region to `1` with `render(error, scope)`. The bindings of a failed region find no node and are skipped until a reset. A binding that throws with no region around it is rethrown to the loader (`console.error` and `onError`).
- **Server.** The body is built in a `try` block. A throw in a hole, helper or child writes the catch view under state `1` and nothing of the body, and rolls back the head output of the body. A throw inside the catch view is not caught. A condition branch or row template with a `<Try>` builds the region the same way.
- **`idlip:error`.** A `CustomEvent` on `document`, `detail: { error, path }` (`error` as thrown, `path` the component's model path, `''` for the root), behind `HAS_ERRORS`. It fires for a binding that throws in a `<Try>` (after the swap), a handler that throws (model kept), a chunk that fails after the retry, and a failed patch.
- **Retry.** Behind `HAS_RETRY`, `load` imports a failed chunk once more at once, under the URL plus `#r<n>` (`n` counts earlier failed loads of that URL). A second failure rejects and the loader reports it. The next event with the same tag tries again.
- **Testing.** `settled()` of `idlip/testing` rethrows an error a region caught unless `mount` gets `expectCaught: true`.

### Subscriptions

- `manifest.sources?: string[]`: source names, absent without `<Subscribe>`. Chunk `source=<name>` (file `source.<name>.js`) exports `source`, the async generator. `HAS_SUBS` is on when `sources` exists.
- Marker: `<!--c<id>:s--><template i-sub="<name>" i-input="<json>" i-key="<json>" on:value="<DomMessage>" i-a="<ids>"></template><!--/c-->`. `:s` marks a subscription block, so `onBlock` starts and stops it, also in `<For>` rows. `i-input` and `i-key` are written only when the attribute exists and the input is read once at start. `on:value` is a DomMessage with `["$event", ...]` placeholders filled with the yielded value; it is not an event type. `i-a` lists the key binding and a `setOn` binding when `on:value` reads state.
- When `key` reads state, one `a<id>` binding calls `restartSub(el, input, key)` from `idlip/client` with the JSON text of both. A different key writes both attributes and restarts the run; the same key does nothing.
- The loader starts every `template[i-sub]` on the page. `QueuedEvent.done` is called once the batch that ran the event has patched (or the event is dropped or fails to load), and `signal` drops an event whose signal is aborted, so one value is in flight.

### Head

- `Manifest.head?: true` (`HAS_HEAD`). Body marker: `<!--c<id>:h--><template i-head="<n>" i-a="<ids>"></template><!--/c-->`. Each element of the block, in `<head>`, carries `i-head="<n>.<index>"` (index counts the elements of that `<Head>` from 0). A `<Head>` holds elements only and at most one `<title>` (`head-title-twice`).
- A block a patch adds writes its elements inside the marker (`<template i-head="">…</template>`). The block hook picks a number above every `i-head` on the page (`p<counter>`), writes `<n>.<index>` on the elements, moves them into `document.head` and writes `<n>` on the marker. The remove hook removes the elements whose `i-head` starts with `<n>.`.
- Bindings: `a<id>` with the marker as `el`; the chunk finds the element with `[i-head="<n>.<index>"]`. A title with a state hole is one binding that sets the whole text.
- Title: the last `<title>` of the page wins, in the order of the markers in the body. The loader puts the last one first in `<head>` and watches `<head>` with a `MutationObserver`.
- Server: `RenderContext` has optional `headId()`, `head(id, markup, title?)`, `headMark()` and `headRollback(mark)`, which generated code calls with `?.`. `renderPage(component, props, options)` from `idlip/server` returns `{ head, body }`: the last title first, then the other elements in markup order, then the other titles. `render()` still returns the body string and warns in DEV when the page has head output. The host writes `head` in `<head>` and `body` in `<body>`. `mount` puts head output in `document.head` and `compareTrees` ignores `i-head`.

### Raw HTML

An element with `html={trusted(value)}` has one element binding `a<id>` in its `i-a`, generated only when the value reads state. It replaces the element's content with the parsed value. The server writes the value as is between the tags, with no markers. The binding calls the loader's `parseHtml`, which holds the one Trusted Types policy `idlip`, so it costs no loader bytes and needs no flag. URL attributes go through `safeUrl` (core-api); raw HTML only through `trusted`.

### Dynamic holes

A hole whose paths the analysis cannot list (`paths: 'dynamic'`, see view-ir) records them at run time.

- One group, key `$dynamic`, `paths: []`, `chunk: 'binding=$dynamic'`, `bindings` the dynamic holes, `covers: []`, last in `groups`. Only top-level holes of a root component are in it, and it exists only when the module has one. The chunk exports every dynamic binding, called with `(node, { model, dynamic })`.
- `PageState.dynamic?: Record<string, string[]>`: binding name to the model paths the hole read on its last run, in manifest form (`todos.*.done`, indexes as `*`, no keyed segments). The server fills it (`track` from `idlip/server`, `const dynamic$ = {}` passed to `context.state`) and `render()` writes it. `Page.dynamic` and `Scope.dynamic` hold the same object on the client, root only: a child has none, so a child binds a dynamic hole statically from `Hole.fallback`.
- Each run replaces the entry (`track$`, copied into the chunk). The loader selects `$dynamic` when `diffPaths` over the recorded paths of any hole reports a change and runs only the holes whose paths changed. A handler entry with `bindings` also lists `$dynamic` when the group exists. `HAS_DYNAMIC` is on when a manifest has the group.

### Build id and skew

- The state script carries `i-build="<id>"`: 8 hex digits, a hash of the client build's file names. Absent in dev and when the plugin option `skew` is `false`. The chunk URL map has the extra key `build` with the id, which `render()` moves to the attribute.
- The client build writes `build.js` next to the loader entry: the build id as default export and `check()`. A script is used, not `fetch`, because a strict CSP blocks a `fetch` and allows a dynamic `import()`. When a chunk fails for good, the loader imports `build.js` from its own folder and calls `check()`. Serve `build.js` with `Cache-Control: no-store` or a short max age.
- `check()` compares the page's `i-build` with the build's. When they differ and `sessionStorage['idlip:builds']` (build id to `'reloaded'`) does not list it, it records it and reloads, so a cache that serves the old page again does not loop.
- Retention: the client build keeps the files of the previous build and deletes those of older ones (`emptyOutDir: false`, `<outDir>/.idlip/builds.json` lists the files per build, `publicDir` is never touched). It needs `build.outDir` kept between deploys. A page two builds old loses its chunks and the reload recovers it. `HAS_SKEW` follows the plugin option `skew` (default on).

### Hot updates (dev only)

After an edit of a `*.idlip.tsx` file in `vite dev` the plugin sends one Vite event `idlip:hot` with `{ module, kind: 'swap' | 'remount', chunks, timestamp }`. `swap`: the server module is the same, `chunks` are the URLs of changed chunks, and the loader imports each again with `t=<timestamp>`; the next event runs the new code on the same model. `remount`: the server module changed, `chunks` is every chunk URL; the loader fetches the page, replaces `body`, reads the new state records and patches each root from its fresh model to the model it had (fields the new model lacks are dropped, new fields take their initial value). A module that does not compile sends `full-reload`, an edit that changes no chunk sends nothing. The listener sits behind `import.meta.hot`, so a build holds none of it.

### Reserved

- `$p` sources of keyed paths (`keyed-writes`) and `ops` on handler entries (`update-ops`).
- A child's own subscriptions use the boundary path as their scope (`commands-subs`).
- `Step.send` beyond the message-prop case.

## Stub

The golden fixtures are the stub for both sides: `counter`, `todo`, `effects`, `keyed`, `nested/counter` and `nested/board`. Each folder has:

- `<name>.idlip.tsx`: the source. The counter is the one of `spike-view-analysis`. The todo is the 0002 example without `await` (ids come from a `next` counter, `persist` waits for `custom-effects`), with a form submit with `prevent` and an input with the key filter `Escape`.
- `input.json`: the module id (`/src/todo.idlip.tsx`), the source file name, and the props to render.
- `expected/server.js`, `expected/manifest.json`, `expected/page.html` (the `render()` output for the props), and `expected/client/<file>` for each chunk.

`test/fixtures/reference.ts` holds reference versions of `text`, `attr`, `on`, the state script writer, `diffPaths` and the covers walk. The fixture test renders `server.js` with them and compares the page.

## Contract tests

`packages/idlip/test/fixtures/fixtures.test.ts`, run with `pnpm --filter idlip exec vitest run test/fixtures`. For each fixture it checks that every file parses, the manifest's shape, that the server module exports the manifest, one file per chunk, the exports of each chunk against the manifest and the covers rule, that the server module renders `page.html`, that list rows rendered from the item template match the page, and that every binding's node is in the page, and that the server module maps every chunk id to its URL. The nested fixtures also check that markers pair with slots, the `modules` entry, owners in the DOM, slot paths, the `setProp` calls of a reorder and that a relabel loads only `binding=items.*.label`. It also runs the handler chunks, checks with a reference `diffPaths` and covers walk that the first toggle loads only `binding=todos.*.done`, and checks that a keyed reorder that moves `done` counts as a change.

## Changes

- v11 (2026-11-21, curator pass after wave 8; contracts `compiled-format-*.change-request.md` of `write-sets`, `nesting-format`, `dom-refs`, `commands-subs`, `errors`, `errors-client`, `document-head`, `svg-and-html`, `deploy-skew`, `dynamic-paths`, `form-fields`, `hmr`, `prefetch`, merged from the code on `batch/core`): write sets and `bindings` on handler entries; nested components (boundaries, slots, `p` bindings, `view` chunk, `uses`, owners); `i-ref` and `Step.after`; `<Subscribe>` markers and `sources`; `<Try>` regions, `try=<id>` chunks, `reset`, `idlip:error` and the retry; `<Head>` markers and `renderPage`; raw HTML as an `a` binding; build id, `build.js` and retention; dynamic holes and the `$dynamic` group; form fields as event paths (`$form` removed); `idlip:hot`; `manifest.listens`; the feature flags. Where the requests and the code differ the code wins: `$step` is optional and tested with `in`, `Step.send` and `let-reserved` are not built, `ComponentState` lives in `server/render.ts`.
- v12 (2026-11-21, `perf-ssr-state`, `compiled-format.v12.change-request.md`): `PageState.modules` holds `ChildManifest` (no `events`, `listens`, `view`, handler `writes`); child `view` chunks leave `chunks`; key order `manifest, chunks, model, props, slots, dynamic, modules`; the server caches the parts of the state that do not change between requests.
- v13 (2026-11-21, `fix-global-late-listener`, `compiled-format.v13.change-request.md`): global events are listed as `<type>:window` and `<type>:document` in `manifest.events` and the record; the listener adds them at record time.
- v10 (2026-11-21, `contracts/compiled-format-tasks.change-request.md`, from `custom-effects` and `run-tasks`): `task` chunk kind and `manifest.tasks` (built-in sites point to the handler chunk), continuation tags and payloads, `runTask(host, task)` replaces `RunTask` (removed from `format.ts` and from this contract), task chunk file ids.
- v10 (2026-11-21, `contracts/compiled-format-keyed.change-request.md`, from `keyed-paths`): `getChunkFile` maps `[`, `]` and `=` in a path to `(`, `)` and `~`; `diffPaths` compares a keyed segment by key.
- v10 (2026-11-21, from `runtime-flags`): `HAS_*` runtime feature flags; the loader budget of 4096 B gzip is the loader with no optional features.
- v9 (2026-11-21, from `testing-mount`): the server render takes an optional model.
- v9 (2026-11-21, from the `resume-loader` review): DOM and render helpers are copied into chunks instead of living in the loader; `stop` uses `stopImmediatePropagation`; more non-bubbling events.
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
