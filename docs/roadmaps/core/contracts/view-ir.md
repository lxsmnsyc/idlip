---
name: view-ir
version: 11
status: frozen
defined_by: spike-view-analysis
---

# Contract: view-ir

Proposed text for `contracts/view-ir.md` v7, written by `spike-view-analysis`. The orchestrator copies it over the contract when it accepts `contracts/view-ir.change-request.md`. The types are in `nodes/spike-view-analysis/prototype/ir.ts`, and the prototype that produces them is `prototype/analyze.ts`.

## Purpose

The output of the component analysis (`compile-view-analyze`) and the input of code generation (`compile-view-codegen`) and of handler compilation (`compile-update`).

## Interface

One `ModuleIR` per `*.idlip.tsx` file:

```ts
interface ModuleIR {
  file: string;
  components: Component[]; // every function declaration with a capitalized name
  diagnostics: Diagnostic[];
}

interface Component {
  name: string;
  exported: boolean;
  mode: 'stateful' | 'stateless'; // stateless: no `let` and no handlers
  props:
    | { kind: 'param'; name: string }
    | { kind: 'pattern'; fields: { key: string; local: string }[] } // `{ b: c }` is key b, local c
    | { kind: 'none' };
  state: { name: string; init: Expr; assigned: boolean }[]; // `let`, in source order
  derived: { name: string; expr: Expr }[]; // `const`, already inlined
  handlers: Handler[];
  view: Node[]; // from `return`
  holes: Hole[]; // every hole in `view`, by id
}

interface Handler {
  name: string; // the message tag
  params: string[]; // the payload, in order
  async: boolean;
  free: {
    name: string;
    kind: 'state' | 'derived' | 'props' | 'handler' | 'import' | 'module' | 'global';
    paths: Path[]; // for `props`: the props paths read, else empty
  }[];
  writes: string[]; // state fields the handler assigns
  segments: { tag: string; carried: string[]; awaits: Root | undefined }[];
  span: Span;
}
```

`segments[0]` is the message itself (`tag` is the handler name). Each later segment starts after one `await`: `tag` is `name$1`, `name$2` and so on, `awaits` is the awaited callee, and `carried` lists the locals declared before the `await` and read after it. They ride in the continuation's payload and must serialize.

A free variable of kind `props` lists the props paths the handler reads, for example `props.start`. 0002 compiles them to payload fields computed at render, so code generation writes them into the event's payload and patches it when those paths change.

### Expressions

Every hole, attribute value, event argument, initial value and derived value is an `Expr` in the closed grammar. Derived values, inlined helpers and the props of inlined components are already substituted.

```ts
type Expr =
  | { kind: 'literal'; value: string | number | boolean | null | undefined }
  | { kind: 'path'; root: Root; segments: Segment[]; optional: boolean }
  | { kind: 'unary'; op: '!' | '-' | '+' | 'typeof'; arg: Expr }
  | { kind: 'binary'; op: BinaryOp; left: Expr; right: Expr }
  | { kind: 'logical'; op: '&&' | '||' | '??'; left: Expr; right: Expr }
  | { kind: 'conditional'; test: Expr; then: Expr; else: Expr }
  | { kind: 'template'; quasis: string[]; exprs: Expr[] }
  | { kind: 'object'; entries: { key: string; value: Expr }[] }
  | { kind: 'array'; items: Expr[] }
  | { kind: 'call'; callee: Root; args: Expr[]; helper: 'args'; impure?: true }
  | { kind: 'call'; callee: Root; args: Expr[]; helper: 'inlined'; body: Expr }
  | { kind: 'method'; receiver: Expr; name: Method; args: Expr[] }
  | { kind: 'property'; receiver: Expr; name: 'length' };

type BinaryOp =
  | '==='
  | '!=='
  | '=='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '**';

type Method =
  | 'trim'
  | 'toUpperCase'
  | 'toLowerCase'
  | 'slice'
  | 'includes'
  | 'startsWith'
  | 'endsWith'
  | 'indexOf'
  | 'join'
  | 'at'
  | 'padStart'
  | 'padEnd'
  | 'toFixed';

type Root =
  | { kind: 'state'; name: string }
  | { kind: 'props' }
  | { kind: 'loop'; name: string; index: boolean }
  | { kind: 'event' } // the DOM event, or the value of a subscription
  | { kind: 'local'; name: string } // the `<Try>` catch error
  | { kind: 'global'; name: string } // `String`, `Number`, `Boolean`, `Math.max`
  | { kind: 'import'; name: string; source: string } // `fmt.count` keeps the dotted name
  | { kind: 'module'; name: string };

type Segment =
  | string // a field
  | { kind: 'item' } // `*`, in path sets only
  | { kind: 'index'; value: Expr } // `labels[filter]`, in expressions only
  | { kind: 'keyed'; field: string; value: Expr }; // `todos[id=selected]`, from `list.find(...)`
```

An inlined call keeps its `args` and adds `body`, the helper's return expression with the arguments substituted. Code generation emits `body`. Inlining falls back to `helper: 'args'` when the body leaves the closed grammar after substitution, for example when the helper reads a field of a parameter (`card.title`) and the argument is not a path (`cond ? a : b`).

Pure globals: a hole may call `String`, `Number`, `Boolean` and `Math.*` (a `call` with a `global` callee and `helper: 'args'`). It may call the `Method` list on any value, and read `.length` on any value. On a path, `.length` stays a field segment (`columns.*.cards.length`); on any other receiver it is a `property` node that reads the receiver's paths. Code generation handles both shapes. None of these methods takes a function argument, except `find` below. Their paths are the paths of the receiver and the arguments: `draft.trim()` reads `draft`. Any other global or method is an error.

Impure globals: a hole may also call `Math.random`, `Date.now`, `performance.now` and `crypto.randomUUID`. The call is marked `impure: true` and reads no paths. A hole patches only when one of its paths changes, so the value is computed on the server and again at each patch of that hole. When the hole's path set is empty, it renders once on the server and never patches, and no diagnostic is given. When the path set is not empty, the analysis gives the warning `hole-impure`, which names the paths that recompute the value. Handlers keep `handler-impure` as an error, because a handler's result enters the model and the message log. Impure globals are allowed only in holes, which include attribute values. In event arguments and message props they are `hole-global`, since the value would be fixed in the payload at render. In state initial values they are `let-init`. A `loop` root object is shared by every expression in its row, so code generation can tell two loops with the same variable name apart by identity.

Keyed lookup: `list.find((p) => p.<field> === <expr>)` is allowed when `list` is a state or props path. Either side of `===` may hold the item field. The call lowers to a `path` expression: the list path plus `{ kind: 'keyed', field, value }`. Segments after it read the found item and are optional (`?.`), because `find` can return nothing. Other forms of `find` (a `function` expression, another test) stay `hole-method`. A list reached through a loop variable never gets a keyed segment; it falls back to `*`.

### Holes and paths

```ts
interface Path {
  root: 'state' | 'props';
  segments: Segment[]; // fields, `item` and `keyed`
}

interface Hole {
  id: number;
  expr: Expr;
  paths: Path[] | 'dynamic';
  /** The coarse static paths of a dynamic hole, used where a template records no reads. */
  fallback?: Path[];
  span: Span;
}
```

A path is written `todos.*.done` or `props.initial`.

### View nodes

```ts
type Node =
  | { kind: 'text'; value: string } // JSX whitespace already trimmed
  | { kind: 'text-hole'; hole: Hole }
  | {
      kind: 'element';
      tag: string;
      namespace: 'html' | 'svg' | 'mathml';
      attrs: {
        name: string;
        value: { kind: 'static'; value: string | true } | { kind: 'hole'; hole: Hole };
      }[];
      events: Event[];
      ref: { kind: 'name'; name: string } | { kind: 'tuple'; name: string; key: Expr } | undefined;
      html: Hole | undefined; // html={trusted(x)}: the hole is `x`
      children: Node[];
      span: Span;
    }
  | {
      kind: 'for';
      each: Hole;
      key: string;
      item: string;
      index: string | undefined;
      namespace: Namespace;
      body: Node[];
    }
  | { kind: 'condition'; test: Hole; then: Node[]; else: Node[]; namespace: Namespace }
  | { kind: 'try'; body: Node[]; error: string; reset: string | undefined; catch: Node[] }
  | { kind: 'head'; children: Node[] }
  | {
      kind: 'subscribe';
      source: Root;
      input: Hole | undefined;
      key: Hole | undefined;
      events: Event[];
    }
  | { kind: 'global'; target: 'window' | 'document'; events: Event[] }
  | {
      kind: 'child';
      component: Root;
      props: { name: string; value: Hole }[];
      messages: Event[];
      slot: Slot;
    };

type Slot = { kind: 'key'; hole: Hole } | { kind: 'for-key' } | { kind: 'position'; index: number };

interface Event {
  name: string; // `click`, or the prop name `onRemove` for a message prop
  mode: 'on' | 'latest';
  target: { kind: 'handler'; name: string } | { kind: 'prop'; name: string } | { kind: 'reset' };
  args: Expr[];
  paths: Path[]; // model paths the arguments read at render
  modifiers: EventModifier[]; // reserved, always empty until `jsx-types` fixes the syntax
  span: Span;
}

type EventModifier =
  | { kind: 'prevent' }
  | { kind: 'stop' }
  | { kind: 'once' }
  | { kind: 'capture' }
  | { kind: 'passive' }
  | { kind: 'key'; filter: string }; // `Enter`, `Mod+s`

interface Diagnostic {
  rule: string;
  severity: 'error' | 'warning';
  message: string;
  span: Span;
}

interface Span {
  start: number;
  end: number;
}
```

## Behavior

### Paths

- A path set lists model paths: those that start at a state field, and `props` paths. For the root component, props come from the server and never change. For a child component, a `props.x` binding patches when the parent passes a new `x`.
- `*` is any element of a list or any value of a record.
- A hole's path set is minimal: a path is dropped when a shorter path in the set is its prefix. Updates are immutable, so a change under `todos.*.done` also changes `todos`.
- Loop items. When `each` is a path, an item read `t.done` resolves to `each` + `*` + `done`, for example `todos.*.done`. When `each` is anything else (a helper call), item reads resolve to the paths of `each`. A read of the index variable resolves to the list path.
- Computed access `a[k]` resolves to `a.*` plus the paths of `k`. Literal keys are fields: `columns[0].name` is `columns.0.name`.
- A helper call with `helper: 'args'` reads the union of its argument paths. With `helper: 'inlined'`, it reads the paths of `body`, which are exact.
- Imports and module-level bindings have no paths. A hole that reads only them, or only literals, has an empty path set and never patches.
- `loop`, `event`, `local` and `global` roots never appear in a path set.
- A hole gets `paths: 'dynamic'` when all hold: it is a text hole or an attribute value; some call in it has `helper: 'args'`, a `module` or `import` callee and an `object` argument; and it reads no `loop`, `local` or `event` root and calls no impure global. The `object` argument is an alias of the model (`const view = { todos, filter }` passed to a helper) or the whole `props` of an inlined stateless component (`summarize(props)`). `props-whole` stays for a computed key on `props` (`props[props.k]`). `Hole.expr` keeps the lowered expression and holes that are not dynamic keep their exact paths. A dynamic hole keeps its coarse static paths in `Hole.fallback`, and code generation binds it as a static hole inside `<For>`, conditions, `<Try>` and child components, where templates record no reads. In a root component's top level the paths are recorded at run time (`contracts/compiled-format.md`, Dynamic holes). `hole-dynamic` is reported by code generation only where a dynamic path set cannot be bound.

### Components

- Each capitalized function declaration in the file is a component. Each lowercase function declaration and each module-level `const` arrow is a helper or a subscription source.
- A component's body is `let` and `const` declarations, function declarations, type declarations and one final `return`.
- A stateless component is inlined at each use. Its props bind to the caller's expressions, `props.children` or a destructured `children` places the caller's children, and an `onX` prop forwards the caller's event. On its own, the analysis still emits its IR: `props.*` paths, children as an empty slot.
- A stateful component used in JSX is a `child` node. Its `onX` props are `messages`. Its slot is the `key` prop, else the `<For>` key inside a loop, else its position among child blocks of the component.
- An imported component: the analysis follows the import, reads the imported `.idlip.tsx` source and applies the same stateless rule as for a local component. A stateless import is inlined, a stateful one is a `child` node. An import of a component that is not from an `.idlip.tsx` file is the error `component-import`. The prototype reads one file only: it checks the source suffix and always emits a `child` node.

### Events

- `on:click={h}` dispatches `h` with no arguments. `on:click={() => h(a, b)}` dispatches `h` with `[a, b]`. `on:input={(e) => h(e.currentTarget.value)}` records the argument as an `event` root path, read at dispatch.
- On `<Subscribe>`, `on:value={h}` passes the yielded value: its `args` is `[event root]`.
- Modifiers (v9): An event arrow may have a block body that reads as plain TypeScript and means the same when run (`packages/idlip/test/fixtures/todo/todo.idlip.tsx` uses both forms):

```tsx
<form on:submit={(e) => { e.preventDefault(); add(); }}>
<input on:keydown={(e) => { if (e.key === 'Escape') { clear(); } }} />
```

- Leading `e.preventDefault();` and `e.stopPropagation();` statements, then one handler call, give `{ kind: 'prevent' }` and `{ kind: 'stop' }`.
- `if (<test>) <call>`, or `if (<test>) { <prevent or stop statements> <call> }`, gives `{ kind: 'key', filter }`. The test is `e.key === '<key>'`, joined with `&&` to any of `e.ctrlKey`, `e.altKey`, `e.shiftKey`, `e.metaKey`, in any order. The filter is written `Ctrl+Alt+Shift+Meta+<key>` with only the named keys, such as `Escape` or `Ctrl+s`.
- Prevent or stop statements before an `if`, an `else`, or any other statement stay `event-closure`.
- `once`, `capture` and `passive` have no source form in v9.
- A form field is a property path on the event root (`e.currentTarget.elements.draft.value`), so there is no `form` root. `Event.modifiers` of an element `submit` event always holds `prevent` unless the target is a forwarded message prop.
- A target is a handler of the component, a prop (`props.onRemove`, forwarded to the parent), or the `reset` of a `<Try>`.
- `paths` lists the model paths the arguments read at render, for example `todos.*.id` for `() => toggle(t.id)`, so code generation can patch the payload.

### View

- `cond ? <A /> : <B />` and `cond && <A />` are condition blocks. Chained ternaries nest in `else`. A branch that is `null`, `undefined`, `false` or `''` is empty. A branch that is a plain expression becomes a text hole.
- `<For each key>` takes one child, `(item, index?) => view`. The item may be an object pattern of plain fields, which resolve to item paths.
- `<Try catch={(error, reset) => view}>`, `<Head>`, `<Subscribe to input key on:value>`, `<window>` and `<document>` map to their nodes. `<For>`, `<Try>`, `<Head>` and `<Subscribe>` must be imported from `idlip`.
- `<foreignObject>` returns its children to the HTML namespace.

### Diagnostics

Every diagnostic carries a rule id. All are errors except `let-unassigned` and `hole-impure`.

| Area     | Rule ids                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Body     | `body-statement`, `body-var`, `body-destructure`, `body-return`, `props-count`, `props-pattern`, `props-whole`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Paths    | `hole-dynamic` (a dynamic path set that code generation cannot bind)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| State    | `let-annotation`, `let-bare-as`, `let-init`, `let-unassigned` (warning), `init-scope`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Derived  | `derived-jsx`, `derived-cycle`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Holes    | `hole-closure`, `hole-method`, `hole-global`, `hole-handler`, `hole-statement`, `hole-effect`, `hole-unknown`, `hole-operator`, `hole-literal`, `hole-object`, `hole-array`, `hole-spread`, `hole-call`, `hole-member`, `hole-jsx`, `hole-message`, `hole-children`, `hole-function-value`, `hole-grammar`, `hole-impure` (warning), `helper-closure`                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| View     | `view-map`, `condition-operator`, `for-each`, `for-key`, `for-render`, `for-param`, `ref-form`, `ref-key` (the tuple key of a `ref` in a `<For>` must be the innermost `<For>`'s `key` field, such as `ref={['row', t.id]}` under `key="id"`), `html-trusted`, `html-children`, `title-outside-head`, `attr-jsx`, `jsx-spread`, `jsx-namespace-tag`, `component-unknown`, `component-import`, `component-recursive`, `child-children`                                                                                                                                                                                                                                                                                                                                                             |
| Module   | `module-reserved-name` (a module-level declaration or import named like a helper the compiler generates in chunks, such as `setAttr$` or `getText$`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| HTML     | `html-nesting` (the parser closes or moves the element, or text or a text hole sits in a table part, also across `<For>` and condition blocks), `html-raw-text` (a hole in `<script>` or `<style>`, or a hole in `<textarea>` or `<title>` next to other content), `attr-reserved` (an author attribute starting with `i-`), `html-implied` (the parser inserts `<tbody>`, `<tr>` or `<colgroup>`)                                                                                                                                                                                                                                                                                                                                                                                                |
| Events   | `event-closure`, `event-target`, `event-param`, `event-mode-twice`, `event-message-args`, `event-computed-key` (a field is read by a computed name, such as `e.currentTarget.elements[name].value`), `dom-call-position` (`Dom.focus`, `Dom.scrollIntoView` or `Dom.reset` is not a statement of its own), `event-placeholder` (an argument reads the event other than as a whole path, e.g. `e.currentTarget.value.trim()`), `event-passive-prevent` (`passive` with `prevent`; no source form gives `passive` in v9)                                                                                                                                                                                                                                                                            |
| Blocks   | `try-catch`, `subscribe-source`, `subscribe-input-key`, `subscribe-children`, `global-attr`, `global-children`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Handlers | `handler-free`, `handler-assign`, `handler-mutate`, `handler-impure`, `handler-generator`, `await-placement`, `await-callee`, `await-nested` (an await in a catch or finally block, in a block, or in a nested `try`), `await-multiple` (two awaits in one statement), `await-finally` (an await in a `try` that has a `finally`), `await-handler` (a called handler awaits, or a handler awaits and calls itself), `handler-derived-props` (a handler reads a derived value whose props paths the payload cannot carry), `handler-derived-stale` (warning: a derived value read after a state write in the same handler keeps its render-time value), `helper-module-state` (a helper reassigns a module-level `let`), `handler-return-finally` (a `return` inside a `try` that has a `finally`) |
| Parser   | `parse`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

A path set keeps a `keyed` segment only when both hold: the list is the `each` of a `<For>` in the module whose `key` equals `field`, and `value` is a path that starts at a state field and has field names only. Otherwise the segment becomes `*`, and the set also gets the path to the field. `todos.find((t) => t.id === selected).text` gives `selected, todos.*.id, todos.*.text` when no `<For>` keys `id`, and `selected, todos[id=selected].text` when one does. The paths of `value` are always in the set. A path with a prefix in the set covers longer paths, so `todos` also covers `todos[id=selected].text`. The printed form is `todos[id=selected].text`. A module with a `find` and a keyed `<For>` is analyzed twice, because the `<For>` may come after the hole; the first pass's diagnostics are dropped.

The IR does not fix how messages or markers are written into the DOM. `contracts/compiled-format.md` owns that encoding, and `compile-view-codegen` applies it.

## Stub

The prototype's output for the counter and the todo of `docs/proposals/0002-modules.md`:

- `nodes/spike-view-analysis/prototype/out/counter.json` and `out/todo.json`: the full IR.
- `out/counter.txt` and `out/todo.txt`: the same, printed.

The todo, printed:

```text
state:    draft = ""; todos = props.initial; save = { state: "idle" }
derived:  left = countLeft(todos)
handlers: setDraft(text) writes draft
          toggle(id) reads todos, writes todos
          add() writes todos draft; segment add$1 after await Random.id
          persist() writes save; segment persist$1 after await saveTodos
view:
  <main>
    <input value={#0} [on:input -> setDraft($event.currentTarget.value)]>
    <button disabled={#1} [on:click -> add()]> "Add"
    <button disabled={#2} [on:click -> persist()]> "Save"
    <p> {#3} " left"
    for #4 key=id item=t
      <li class={#5}>
        <input type="checkbox" checked={#6} [on:click -> toggle(t.id), render reads todos.*.id]>
        {#7}
holes:
  #0 draft                       -> draft
  #1 draft === ''                -> draft
  #2 save.state === 'saving'     -> save.state
  #3 left = countLeft(todos)     -> todos            (helper: args)
  #4 todos                       -> todos
  #5 { done: t.done }            -> todos.*.done
  #6 t.done                      -> todos.*.done
  #7 t.text                      -> todos.*.text
```

## Contract tests

`packages/idlip/test/compiler/view/`. Port the fixtures in `nodes/spike-view-analysis/prototype/fixtures/` with their printed output as expected values. `violations.idlip.tsx` and `parse.idlip.tsx.txt` (stored as text, since the formatter cannot read a file that does not parse) mark each case with its rule id in a comment, and together cover 73 of the 74 rule ids. `hole-dynamic` has no case, because the analysis never produces a `dynamic` hole.

## Changes

- v11 (2026-11-21, curator pass after wave 8; `view-ir-refs`, `view-ir-form-fields`, `view-ir-dynamic`): `Hole.fallback` and dynamic holes (`paths: 'dynamic'` is now produced); the `form` root is removed; rules `ref-key`, `dom-call-position` and `event-computed-key`; a `submit` event always has `prevent` unless forwarded.
- v10 (2026-11-21, `contracts/view-ir-keyed.change-request.md`, from `keyed-paths`): `list.find((p) => p.field === expr)` lowers to a keyed path segment, and the path-set rule for it. `handler-await` is replaced by `await-nested`, `await-multiple`, `await-finally` and `await-handler` (from `custom-effects`).
- v9 (2026-11-21, `contracts/view-ir-v9.change-request.md`, from `compiled-format`): block-bodied event arrows with leading `e.preventDefault()` / `e.stopPropagation()` and a key test give the `prevent`, `stop` and `key` modifiers. New rule ids `attr-reserved`, `event-placeholder`, `html-raw-text`, `event-passive-prevent`. `html-nesting` covers text holes in table parts across blocks.
- v8 (2026-11-21, `contracts/view-ir-v8.change-request.md`): impure globals in holes. `Math.random`, `Date.now`, `performance.now` and `crypto.randomUUID` are allowed in holes and marked `impure: true`. `hole-impure` becomes a warning, given only when the hole reads paths. Resumability has no hydration check, so a server value that differs from a later client value is not an error; the warning covers a value that changes only when unrelated paths change.
- v7: frozen by `spike-view-analysis`. Fixes the types above. Adds `props` paths, `index` segments, minimal path sets, item paths through helper-computed lists, event `paths`, the `reset` and `prop` targets, the subscription value argument, handler `writes` and `carried` locals, `html-nesting` and `html-implied`, and the rule id list. Allows pure globals and a fixed list of methods in holes. Follows imported components. Reserves event `modifiers` and the `form` root. Records props paths read by handlers and the rename mapping of props patterns. `dynamic` is kept in the type but not produced for the closed grammar.
- v6: reads function components instead of `defineModule`: state fields, derived values, handlers and the view. Event props are handler references or arrows with one handler call. Stateless components are inlined. The `catch` view is replaced by `<Try>` boundary blocks. Adds head blocks and subscription nodes. Source: `docs/proposals/0002-modules.md`, revised 2026-11-21.
- v5: constants in holes, refs, raw HTML holes, namespaces, `catch` view. Source: `docs/proposals/0004-effects-refs-errors.md`.
- v4: closed hole grammar, helper rule, JSX branches as condition blocks instead of `<Show>`, rule ids on diagnostics. Source: `debate/debate.md`, 2026-11-20.
- v3: path type reserves keyed segments. Source: `docs/proposals/0003-update-analysis.md`.
- v2: reads the `view(m, msg)` property of `defineModule`. Adds `dynamic` holes, inlined partials and child blocks. Source: `docs/proposals/0002-modules.md`.
- v1: initial draft.
