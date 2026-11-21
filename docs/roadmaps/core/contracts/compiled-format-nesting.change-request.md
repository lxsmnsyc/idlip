# Change request: compiled-format v9 to v10

- From node: nesting-format
- Status: open

## Problem

`compiled-format` has no encoding for a stateful child component. Its Reserved section lists "a component boundary marker that carries the component's model path, and the path on each queued message". Without it, `nesting-compile` and `nesting-runtime` cannot start. Four things are open:

- Where a child's model lives, and how it is named.
- How a click in a child reaches the child's handler, and how a click on a callback prop reaches the parent's handler.
- How a child that the client adds (a new row of a `<For>`) gets its first model and markup, with no server render.
- How the loader stays inside its budget (4061 of 4096 B gzip) while it learns about children.

`docs/proposals/0002-modules.md` (Props and nesting) fixes the rules: slots by position or `key`, the loop key inside `<For>`, messages that carry the child's path apart from the tag, callback props as message props, stateless components inlined. This request turns them into a format. The golden fixtures `packages/idlip/test/fixtures/nested/board/` (a parent with a position child and a keyed `<For>` of children with an `onRemove` message prop) and `nested/counter/` (the stateful child) show every part below, and the fixture test checks them.

Prior art: brumate names a scope by its parent's scope ID plus the call position (`$id()`), and loads a child's client module when the scope is made (`../brumate/docs/compiler.md`, Render modules). The slot names below follow that. brumate keeps a scope tree in memory. idlip keeps one flat table of plain data, because the state script must serialize it and no closure may survive.

## Proposed change

Each heading is the section of `contracts/compiled-format.md` that it changes.

### Interface

New and changed types in `src/core/format.ts`:

```ts
/** A rendered child: its module, its model and the props the client reads. */
interface Slot {
  readonly module: string;
  readonly model: Model;
  readonly props: Props;
}

interface PageState {
  /* manifest, chunks, model, props as before */
  /** Manifests of the child modules on the page and of the modules those can render. */
  readonly modules?: Readonly<Record<string, Manifest>>;
  /** Rendered children by model path. */
  readonly slots?: Readonly<Record<string, Slot>>;
}

// DomMessage gains a fourth item: the model path of the component that owns the handler.
type DomMessage =
  | readonly [tag: string, payload: readonly unknown[]]
  | readonly [tag: string, payload: readonly unknown[], modifiers: string]
  | readonly [tag: string, payload: readonly unknown[], modifiers: string, owner: string];

interface QueuedEvent {
  /* as before */
  /** Item 3 of the message: set for a forwarded message prop, absent otherwise. */
  readonly owner?: string;
}

interface Manifest {
  /* as before */
  /** Present when a project module renders this module as a child. */
  readonly view?: { readonly chunk: string }; // always 'view'
}

interface Scope {
  /* model, props, rows as before */
  /** The model path of the component the binding belongs to. Absent means the root, ''. */
  readonly path?: string;
}

/** `p<id>`: a props binding. It has no node. It names a slot by path. */
type PropBinding = (scope: Scope) => void;

/** The `view` chunk of a child module. */
interface ViewChunk {
  /** The initial model from the state initializers and the props. */
  readonly init: (props: Props) => Model;
  /** The whole view, without the boundary markers. */
  readonly render: (scope: Scope) => string;
}

/** What the loader keeps per path. The state script holds only `Slot`, which becomes gen 0. */
type SlotEntry =
  | (Slot & { readonly kind: 'live'; readonly gen: number })
  | { readonly kind: 'removed'; readonly gen: number };

interface Step {
  /** The discriminant: a handler result is a `Step` exactly when `$step` is `true`. */
  readonly $step: true;
  readonly model: Model;
  readonly task?: Task; // now optional
  /** Messages for other components, from a handler that calls a message prop. */
  readonly send?: readonly DomMessage[];
}

interface RenderContext {
  state(state: ComponentState, path?: string): void; // path is new
  /** The slots to render from, set when a test re-renders from a model. */
  readonly slots?: Readonly<Record<string, Slot>>;
}
interface ComponentState extends PageState {
  /** The server modules of the children this component can render. */
  readonly uses?: readonly Pick<ServerModule, 'manifest' | 'chunks' | 'uses'>[];
}
type ServerRender = (props: Props, context: RenderContext, model?: Model, path?: string) => string;
interface ServerModule {
  /* as before */
  readonly uses?: readonly ServerModule[];
}

type Compile = (source: string, id: string, options?: { child?: boolean }) => CompileResult;
```

- `Step` and `Model` are told apart by `$step`, not by which keys exist. The loader's `isStep` tests `result.$step === true`, not `'task' in result`, which would read a step with only `model` and `send` as a model. State fields whose names start with `$` are reserved, so no model has `$step` (compile error `let-reserved`). Every `Step` the compiler emits, task steps included, carries `$step: true`, so `compile-update` and the `effects` goldens change with `nesting-compile`.
- Props and models are immutable plain data. Handlers return new values and `setProp` replaces a prop. seroval keeps shared references, so one object can sit in several slots and in the parent's model after a decode. Mutating it would change them all.
- `Binding` becomes `NodeBinding | ListBinding | PropBinding`.
- `idlip/server` exports `slot(path, site, ...keys)`. `idlip/client` exports `addChild(path, module, view, props)` and `setProp(path, name, value)`. Chunks import both from `idlip/client`, so the loader holds them (see Patching). The compiler copies `slot` into a chunk that needs it, as it does the other pure helpers.
- A `p` export name joins `a`, `t`, `c` and `l`. `getChunkFile('view')` is `view.js`. `getChunkId(module, 'view')` is `<module>?idlip-view&lang.js`.
- `compile` takes `{ child: true }` when a project module renders the module as a child. Only then does the manifest get `view` and `client` get the `view` chunk. `vite-plugin` knows the importers, so the existing counter and todo goldens do not change.

### DOM encoding

- **Boundary.** A child renders as `<!--n:<path>-->…<!--/n-->`. The path is the child's model path. The root has no boundary and the path `''`.
- **Path grammar.** `path = slot ('/' slot)*`, one slot per component level, outermost first. `slot = <site>[':' <key>]*`.
  - `site` is the index of the child in its component, in source order among all child nodes (the `child` nodes of the view IR), counted from 0 and unaffected by conditions and loops.
  - Each `key` part is `String(value)` through `encodeURIComponent`, then `-` becomes `%2D`. A part never holds `/`, `:`, `-` or `>`, so a path splits cleanly and cannot end or open a comment. The helper is `slot(path, site, ...keys)` and the fixture test checks it.
  - Which keys: an explicit `key` prop of the child, and the loop key of every enclosing `<For>`, outermost first. Without both, the slot is the position alone (`0`). Inside a `<For>` the loop key is always present, because `<For>` requires `key`. An explicit `key` inside a loop adds a part, so it cannot collide across rows.
  - Examples from the fixture: `0` (the position child), `1:a1` (site 1, loop key `a1`), `1:a1/0` (the first child of that child).
- **Lookups stay inside one component.** Binding ids restart in each module, so `t0` and `i-a="2"` occur in the parent and in every child. A component's bindings are found between its own boundary comments (the page root for the root), and the search never enters a nested boundary. A row's bindings are found in the row, with the same rule.
- **Rows.** A child is part of the row markup: `<!--i--><!--n:1:a1-->…<!--/n--><!--/i-->`.
- **Blocks.** The boundary is a block for the `onBlock` hooks. `findInnerBlocks` and the marker match recognize `n:` (today `[tcl]\d+`), so removing a row or a branch calls the remove hook for each boundary inside it, children before parents.
- **Events in a child.** The child's own handlers keep today's encoding with no path: `on:click='["increment",[]]'`. The loader finds the path from the boundary around the target (see Patching).
- **Message props.** A callback prop is data, a `DomMessage` with the owner: `['remove', ['a1'], '', '']`. The child writes it into its event attribute with `on('click', props.onRemove)`, and the DOM holds `on:click='["remove",["a1"],"",""]'`. Item 3 is the absolute model path of the component that owns `remove`, here the root `''`. The owner is absolute so a message that passes through several components still reaches its owner. Item 2 may be `''`, which lists no modifiers. A message with item 3 is dispatched to that path. One without it is dispatched to the path of the boundary around its target. "Set" means `!== undefined`: the root's owner `''` is falsy, so the listener and the loader never test it by truthiness.
- **Ids.** A prop value is a hole, so it takes a hole id in view order. A message prop whose arguments read model paths (`remove(c.id)` reads `items.*.id`) takes the next event id after the last hole id, as an event with `paths` does today. A prop hole or message prop with an empty path set exports nothing. In the fixture: `{items.length}` is hole 0, `label="Spare"` is hole 1, the `<For>` is hole 2, `label={c.label}` is hole 3, and the message prop `onRemove={() => remove(c.id)}` is id 4. `onRemove={clearAll}` has no paths and no id.
- **In the child.** `on:click={props.onRemove}` is an event whose handler reads a props path, so it takes an id and an `a` binding (`a2`) in the group `props.onRemove`. `{props.label}` is a text hole with the path `props.label`.

### State script

- `PageState` gains `slots` and `modules` as typed above. Both are omitted when the page has no child, so the counter and todo pages do not change.
- `slots` has one entry per rendered boundary, keyed by path. Its `model` is the child's state fields. Its `props` holds the props fields that a binding of the child reads, the message props included, as for the root.
- `modules` has the manifest of every child module on the page and of every module they can render (the `uses` closure), including a child whose list is empty at render. The client needs the manifest and chunk URLs of a child it adds later. `chunks` covers the same closure: it holds the entries of the root and of every module in `modules`, including each `view` chunk.
- The state record's event types are the union of the events of the root and of `modules`. A parent whose own view has no event attribute still lists the children's events, so the listener attaches them. `manifest.events` stays the module's own list, and `ssr-render` writes the union.
- One state script per root, as before. The slot table is the only place a child's state lives. A child's state is not a field of the parent's model, so a parent handler cannot read it.

### Manifest

- `view?: { chunk: 'view' }` as typed above. Nothing else changes. The parent's manifest does not list its children: `uses` on the server module and `modules` in the page carry them.
- Group keys and covers follow the same rules. The fixture has `items.length` covering `items`, and `items.*.id` and `items.*.label` covering `items`, so a relabel loads `binding=items.*.label` and nothing else (checked in the fixture test).
- A group may hold `p` bindings. The row list's `bindings` includes the row's `p` bindings, as it includes `a` and `t` ones.

### Server module

- `export const uses = [Counter]`, where `Counter` is `import * as Counter from '<specifier of the source>'`. The compiler keeps the source's specifier. Vite resolves it to the child's server module. A module with no stateful child has no `uses` export. `chunks` stays the module's own entries.
- The default export is `Component(props, context, model, path)`. `path` is `''` for the root (the default), and the slot path for a child. A component calls `context.state({ manifest, chunks, uses, model, props }, path)` once. `render()` takes the root's call (path `''` or absent), puts the calls with a path into `slots`, and merges `chunks`, `modules` and the event types from the `uses` closure. This keeps one root state in one script (`context.state`, as before).
- A child call is `Counter.default(props, context, context.slots?.[p]?.model, p)` with `p = slot(path, site, ...keys)`, wrapped as `<!--n:${p}-->…<!--/n-->`. The model argument lets `idlip/testing` re-render from the slots after each message. A message prop is `['remove', [c.id], '', path]`, with the component's own `path`.
- The server reads a child's `let` initializers from its own props, so each child computes its state when it renders.
- A stateless component is inlined (0002), so it has no boundary and no slot.

### Patching

The slot table is a flat map of plain data: `path` to `Slot`. The loader keeps it in the root's record next to the model.

- **Target.** For a queued event the loader takes the path from `event.owner` when it is set, else from the nearest boundary around `event.target`: walk the previous siblings and then the parent, counting `<!--/n-->` and `<!--n:…-->` pairs, and stop at the first unmatched start. No boundary means the root. The walk is O(n) in the siblings before the target, so a click in a long list pays for it. `nesting-runtime` may cache the path of each boundary comment in a `WeakMap`, since a boundary's path never changes. The path then gives the slot, its manifest (`modules[slot.module]`) and its model. This happens in the loader, because the listener has 50 B of headroom and the target is a DOM walk. The listener copies item 3 of the message into `owner`, about 15 B, which `resume-loader` must confirm.
- **Run.** The handler chunk comes from the target's manifest. `update(slot.model, payload)` gives the next model, which replaces `slot.model`. The patch then runs on the slot: `patch(page, prev, next)` where `page` is built for the slot (its manifest, its props, its boundary as the lookup root).
- **Props paths.** `diffPaths` reads `props.x` paths from `{ ...model, props }`, so a child's `props.label` group changes when the parent passes a new `label`. The root's props never change, so the same code skips them with no special case. A state field cannot be named `props`, since the component parameter has that name.
- **Props bindings.** A parent's `p<id>(scope)` calls `setProp(slotPath(scope, ...), name, value)`. `setProp` compares the value with `slot.props[name]` by value, as plain data, not by reference: a message prop is a new array on every run, so a reference compare would always differ. When the value differs, it keeps the previous props in the patch's own list of changed slots (data of this patch, not a slot state). It does nothing unless the entry is `live`, which covers a branch that is not rendered. After the parent's patch the loader awaits one patch per recorded slot, parents before children, with the slot's old and new props and its model, so only the child's `props.*` groups run.
- **Slot lifecycle.** Each path has one `SlotEntry` (Interface): `live` or `removed`, plus a generation number. Only the block hooks change it, and nothing else writes the kind:
  - The state script's slots start as `live`, gen 0.
  - `addChild` sets `live` with the gen of the old entry plus one (0 for a new path).
  - The remove hook sets `removed` and keeps the gen as a tombstone.
  - A path with no entry is treated as `removed`.
  - Handlers, `setProp` and patches change a live entry's model and props, never its kind.
- **Late work is dropped.** A message addressed to a path whose entry is not `live` (by owner or by boundary) is dropped, with no handler run. A task started for a slot records `(path, gen)`. When it finishes, its continuation is dispatched only if the entry is `live` with the same gen. So a task from a removed row never writes into a row that was added again under the same key: the new entry has a higher gen. The gen stays in the loader. `Task` and the messages do not carry it.
- **Adding.** A parent's item template chunk (or branch render) calls `addChild(path, module, view, props)`. It runs `view.init(props)` for the model, sets the entry to `live` as above with `{ module, model, props }`, and returns `<!--n:path-->` + `view.render(...)` + `<!--/n-->`. The template chunk imports the child's `view` chunk statically (`import * as Counter from '/src/counter.idlip.tsx?idlip-view&lang.js'`), so the first row costs the child's `view` chunk and nothing the loader holds. The child's manifest comes from `modules`.
- **Removing.** The `onBlock` remove hook sets the entry of each boundary that leaves the page to `removed`. Children go before parents, so a removed row drops its whole subtree. A row that comes back goes through `addChild` and starts from its props with a higher gen.
- **Reorder.** A move keeps the slot. `patchList` moves the row's nodes and does not call the remove hook for a key that is still in the list. Only a key that leaves the list is removed, and only an inserted key calls `addChild`. Slot paths hold keys and not indexes, so a reorder changes no path. The `p` bindings that run on kept rows after a reorder see the same values for the same paths, so `setProp` finds no change. The fixture test checks the paths and the `setProp` calls of a reorder. Decision for the gate: a child's model is not kept after its block is removed.
- **Key or position.** A child with no `key` outside a loop is slotted by position, and it keeps its slot while it is in the page. Moving it in the source changes its site, which `hmr` and `deploy-skew` already treat as a new build. Decision for the gate: `key` on a stateful child is optional.
- **Message props from handlers.** A handler that calls a message prop (`props.onRemove()`) reads the message through the payload (`props$onRemove`, as any props path), and returns `{ model, send: [props$onRemove] }`. After the patch the loader dispatches each message of `send` to its owner. The fixtures have no such handler. Names may change in `nesting-compile`.
- **Loader shape (for `runtime-flags`).** All nesting code lives in one module, `src/client/nesting.ts`, with `addChild`, `setProp` and `installNesting`. The loader has one call site, `if (HAS_CHILDREN) installNesting(seams)`. `seams` holds the two things the loader asks of it: `target(event)`, which returns the root by default, and `flush()`, which returns an empty promise by default. With the flag off, the module, the `n:` marker match and the `owner` copy in the listener leave the build, and no chunk imports `addChild` or `setProp`. `nesting-runtime` fixes the signatures.

### Reserved

Replace "Nested components: a component boundary marker…" with this text: Nested components are defined (Interface to Patching above). Still reserved for later nodes:

- A ref marker for elements inside a child is scoped by component path (`dom-refs`). The path is the boundary's.
- A `<Try>` region around a child follows `errors`. The boundary sits inside the region, so removing the region drops the slots.
- A child's own subscriptions (`commands-subs`) use the boundary path as their scope.
- `Step.send` beyond the message-prop case.

Also add `v10` to Changes, and replace the Stub paragraph with `counter`, `todo`, `nested/counter` and `nested/board`. Contract tests: the four fixtures, plus the nested checks below.

## Affected nodes

- `nesting-compile`: emits boundaries, slots, `p` bindings, `view` chunks, `uses`, owners.
- `nesting-runtime`: the loader's target, the slot table, `setProp`, `addChild`, the block hooks, the listener's `owner`.
- `runtime-flags`: puts `src/client/nesting.ts` behind `HAS_CHILDREN`.
- `compile-update`, `run-tasks` and their `effects` goldens: every `Step` gets `$step: true`, and `resume.ts` `isStep` tests it.
- `ssr-render`: merges `slots`, `modules`, `chunks` and event types.
- `testing-mount` (`idlip/testing`): re-renders children from `context.slots`.
- `resume-loader`, `patch-bindings`, `patch-lists`: the owner, props paths in `diffPaths`, the boundary scope and the `n:` block.
- `compile-integration` and `vite-plugin`: the `child` option and the `view` chunk id.
- `hmr`, `deploy-skew`: a moved site is a new slot.

## Workaround in place

The fixtures `packages/idlip/test/fixtures/nested/` carry the proposed format. `fixtures.test.ts` and `reference.ts` (shared with the brief) handle it:

- `reference.ts` has `slot`, `addChild`, `createContext` with paths, `uses` and the union of event types, and the types `Slot`, `ModuleInfo`, `ComponentState` and `NestedContext`, since `format.ts` is not edited here.
- `fixtures.test.ts` lists the two nested fixtures, mocks the child's server module and `view` chunk, skips `p` bindings in the node check (they have no node), counts `manifest.view` as a chunk, and runs the nested checks: markers pair with slots, the `modules` entry, owners in the DOM, slot paths, `setProp` calls and the chunk choice for a relabel.
- The nested `server.js` imports `../../counter/counter.idlip.tsx`, the source's `../counter/…` with one more `../` for the `expected` folder.

## Decision

<Filled in by the orchestrator.>
