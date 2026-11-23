---
title: Component syntax
order: 107
section: Reference
description: What a *.tsx module may hold, the closed hole grammar, event props, block components and every diagnostic rule id.
---

An idlip component is a TSX function in a `*.tsx` file. The source is plain TypeScript, so `tsc` checks it with the types of `idlip/jsx-runtime`. The compiler accepts a closed subset of it and reports anything else as a diagnostic with a rule id, listed [at the end of this page](#diagnostics).

## Modules

A module has one default export, the root component. Other capitalized function declarations are components too. Lowercase function declarations and module-level `const` arrows are helpers or subscription sources. Imports and module-level constants have no model paths, so a hole that reads only them never patches.

```tsx live
import { For } from 'idlip';

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

function countLeft(todos: readonly Todo[]): number {
  let left = 0;
  for (const todo of todos) {
    if (!todo.done) {
      left++;
    }
  }
  return left;
}

export default function TodoApp(props: { initial: Todo[] }) {
  let todos = props.initial;

  const left = countLeft(todos);

  function toggle(id: string) {
    todos = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  }

  return (
    <main>
      <p>{left} left</p>
      <ul>
        <For each={todos} key={(t) => t.id}>
          {(t) => (
            <li class={{ done: t.done }}>
              <input type="checkbox" checked={t.done} on:click={() => toggle(t.id)} />
              {t.text}
            </li>
          )}
        </For>
      </ul>
    </main>
  );
}
```

```json live props.json
{
  "initial": [
    {
      "id": "t1",
      "text": "Read the guide",
      "done": true
    },
    {
      "id": "t2",
      "text": "Write a component",
      "done": false
    }
  ]
}
```

## Component body

The body holds `let` and `const` declarations, function declarations, type declarations and one final `return` (`body-statement`, `body-return`).

- `let` is state. Its initial value may read props. A `let` that no handler assigns is the warning `let-unassigned`. To give a `let` a type, write `let x = value satisfies T as T`, not `let x: T = value` (`let-annotation`).
- `const` is derived. It is computed from state and props on the server and again in each binding that reads it. It holds no JSX (`derived-jsx`).
- A function declaration is a handler. It assigns state with `=`, and never mutates a value in place (`handler-mutate`). It reads no impure global such as `Date.now()` directly (`handler-impure`); await `Time.now()` or `Random.id()` instead.
- `return` is the view.

Props are one parameter, `props` or a destructuring pattern of plain fields (`props-count`, `props-pattern`).

## Holes

A hole is an expression in the view: a text child or an attribute value. The compiler resolves the model paths each hole reads, such as `todos.*.done`, and a binding patches only when one of its paths changes. Holes use a closed grammar:

- Literals, state, props, loop variables, derived values and imports.
- The unary operators `!`, `-`, `+` and `typeof`.
- Comparison, arithmetic, `&&`, `||`, `??` and the conditional operator.
- Template literals, and object and array literals.
- Calls to module helpers and imported functions with plain arguments, and to `String`, `Number`, `Boolean` and `Math.*`.
- The methods `trim`, `toUpperCase`, `toLowerCase`, `slice`, `includes`, `startsWith`, `endsWith`, `indexOf`, `join`, `at`, `padStart`, `padEnd`, `toFixed`, and `.length` on any value.
- A keyed lookup `list.find((t) => t.id === selected)` on a state or props list. Under a `<For>` with `key={(t) => t.id}`, it reads `todos[id=selected]`, so it patches only when that item changes.

Spreads, closures, other globals and other methods are errors (`hole-spread`, `hole-closure`, `hole-global`, `hole-method`). Impure globals (`Math.random`, `Date.now`, `performance.now`, `crypto.randomUUID`) are allowed in holes only, and give the warning `hole-impure` when the hole also reads paths, since the value is computed again at each patch.

## Views

- `cond ? <A /> : <B />` and `cond && <A />` are condition blocks. JSX after `||` or `??` is `condition-operator`. A branch that is `null`, `undefined`, `false` or `''` is empty.
- `.map` in the view is the error `view-map`: use `<For>`.
- `<For>`, `<Try>`, `<Head>` and `<Subscribe>` must be imported from `idlip`. See [idlip](./idlip.md#block-components).
- `<svg>` and `<math>` children keep their namespace. `<foreignObject>` returns its children to HTML.
- The markup must parse as written. An element that the HTML parser would close, move or wrap is an error (`html-nesting`, `html-implied`), such as a `<div>` inside a `<p>` or a `<tr>` directly in a `<table>`.

```tsx live
export default function Status(props: { count: number }) {
  let count = props.count;

  function reset() {
    count = 0;
  }

  return (
    <section>
      {count === 0 ? <p>Nothing yet</p> : <p>{count} items</p>}
      {count > 0 && <button on:click={reset}>Reset</button>}
    </section>
  );
}
```

```json live props.json
{
  "count": 3
}
```

## Attributes

- `class` takes a string or a record of booleans: `class={{ done: t.done }}`.
- `ref="name"` names an element for `Dom`. In a `<For>`, `ref={['row', t.id]}` names the element of one row, with the innermost `<For>`'s key field (`ref-key`; a computed key has no field to name).
- `html={trusted(value)}` writes raw HTML. The element takes no children (`html-trusted`, `html-children`).
- `key` on a child component names its model slot.
- A bound URL attribute (`href`, `src`, `action` and the like) drops `javascript:` and `vbscript:` URLs. Embedding attributes also drop `data:` URLs other than raster images.
- An attribute starting with `i-` is reserved (`attr-reserved`). A plain `onclick` style attribute is an error (`attr-event`): use `on:click`.
- JSX spread props are an error (`jsx-spread`).

## Events

`on:<event>` dispatches a message. Its value is a handler, or an arrow that calls handlers. The arrow compiles to a function in the handler chunk. It reads the event, the state, the props and the row when it runs, after the event has dispatched, and returns the messages. The page holds only its name.

```tsx live
export default function Editor() {
  let draft = '';
  let saved = '';

  function setDraft(text: string) {
    draft = text;
  }
  function save() {
    saved = draft;
  }
  function clear() {
    draft = '';
  }

  return (
    <form on:submit={save}>
      <input
        value={draft}
        on:input={(e) => setDraft(e.currentTarget.value)}
        on:keydown={(e) => {
          if (e.key === 'Escape') {
            clear();
          }
        }}
      />
      <output>{saved}</output>
    </form>
  );
}
```

- A block body may start with `e.preventDefault();` and `e.stopPropagation();`, which the compiler lifts to the page, since the browser must see them while the event dispatches. A conditional prevent is `if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); }` at the start, with nothing else inside. A sole `if (e.key === '<key>')`, joined with `&&` to `e.ctrlKey`, `e.altKey`, `e.shiftKey` or `e.metaKey`, filters by key before any chunk loads. The rest of the body holds handler calls, `if` and `else` on any expression of the view, and `const` declarations, in any number. Any other statement is `event-statement`, and an arrow with no call is `event-no-call`. An event arrow is not `async` (`event-closure`).
- A `submit` event on an element always prevents the default, so a form does not navigate.
- A form field is read by name from the submit event: `e.currentTarget.elements.draft.value`. A computed name is read when the arrow runs.
- `latest:<event>` takes the same values and opts into latest-wins delivery: while a chunk loads or a patch runs, a new event replaces the pending one for the same element and event. Use it for `pointermove`, `scroll` and `resize`. `on:` and `latest:` for the same event on one element is `event-mode-twice`.
- `<window>` and `<document>` take only event props, for global events such as `on:keydown` (`global-attr`, `global-children`).

## Handlers and effects

A handler may `await` a call. The handler is split at each `await`. The part before it runs on the click. The loader then runs the call and records its outcome. The part after it runs as a continuation, with the state at that moment.

```tsx live
import { Time } from 'idlip';

export default function Saver() {
  let status = 'idle';

  async function save() {
    status = 'saving';
    try {
      await Time.sleep(500);
      status = 'saved';
    } catch {
      status = 'failed';
    }
  }

  return (
    <button on:click={save} disabled={status === 'saving'}>
      {status}
    </button>
  );
}
```

- An `await` sits at the top level of the handler body or of one `try` block. It is not inside an `if`, a loop, a `switch` or a conditional or logical expression (`await-placement`). It is not in a `catch`, a `finally`, a nested block or a nested `try` either (`await-nested`). One statement has one `await` (`await-multiple`), and a `try` with an `await` has no `finally` (`await-finally`).
- The awaited call is an import, a module function, or a built-in: `Random.id`, `Random.number`, `Time.now`, `Time.sleep`, `Dom.measure` (`await-callee`).
- A handler that awaits is not called from another handler (`await-handler`).
- `Dom.focus`, `Dom.scrollIntoView` and `Dom.reset` run after the patch, each as a statement of its own (`dom-call-position`).

## Children

A component used in JSX is inlined when it is stateless: no `let` and no handler. Its props bind to the caller's expressions, and `props.children` places the caller's children.

A stateful component is a child with its own model slot. It must be the default export of its own `*.tsx` file, imported by that name. Its `onX` props are message props: the parent passes `() => handler(args)`, and the child dispatches it with `on:click={props.onRemove}`.

```tsx
import { For } from 'idlip';
import Counter from './counter.tsx';

interface Item {
  id: string;
  label: string;
}

export default function Board(props: { items: Item[] }) {
  let items = props.items;

  function remove(id: string) {
    items = items.filter((item) => item.id !== id);
  }

  return (
    <main>
      <For each={items} key={(c) => c.id}>
        {(c) => <Counter label={c.label} start={0} onRemove={() => remove(c.id)} />}
      </For>
    </main>
  );
}
```

A child's slot is its `key` prop, else the `<For>` key inside a loop, else its position among the child blocks of the component. A child takes no JSX children (`child-children`).

## Diagnostics

Each diagnostic has a rule id and a severity. All are errors except `let-unassigned`, `hole-impure` and `handler-derived-stale`, which are warnings. An error stops the build of the module. A warning does not.

| Area     | Rule ids                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Body     | `body-statement`, `body-var`, `body-destructure`, `body-return`, `props-count`, `props-pattern`, `props-whole`                                                                                                                                                                                                                                                                                                                                                                                                       |
| State    | `let-annotation`, `let-bare-as`, `let-init`, `let-unassigned` (warning), `init-scope`                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Derived  | `derived-jsx`, `derived-cycle`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Holes    | `hole-closure`, `hole-method`, `hole-global`, `hole-handler`, `hole-statement`, `hole-effect`, `hole-unknown`, `hole-operator`, `hole-literal`, `hole-object`, `hole-array`, `hole-spread`, `hole-call`, `hole-member`, `hole-jsx`, `hole-message`, `hole-children`, `hole-function-value`, `hole-grammar`, `hole-impure` (warning), `helper-closure`, `hole-dynamic` (a path set that code generation cannot bind)                                                                                                  |
| View     | `view-map`, `condition-operator`, `for-each`, `for-key`, `for-render`, `for-param`, `ref-form`, `ref-key`, `html-trusted`, `srcdoc-trusted` (a bound `srcdoc` that is not `trusted(...)`), `html-children`, `html-element` (`html` on an element that cannot hold raw HTML), `title-outside-head`, `head-title-twice`, `attr-jsx`, `attr-event`, `jsx-spread`, `jsx-namespace-tag`, `component-unknown`, `component-import`, `component-recursive`, `child-children`                                                 |
| Module   | `module-reserved-name` (a declaration or import named like a helper the compiler generates, such as `setAttr$`)                                                                                                                                                                                                                                                                                                                                                                                                      |
| HTML     | `html-nesting` (the parser would close or move the element, or text sits in a table part), `html-raw-text` (a hole in `<script>` or `<style>`, or a hole next to other content in `<textarea>` or `<title>`), `attr-reserved` (an attribute starting with `i-`), `html-implied` (the parser would insert `<tbody>`, `<tr>` or `<colgroup>`)                                                                                                                                                                          |
| Events   | `event-closure`, `event-target`, `event-param`, `event-mode-twice`, `event-message-args`, `event-statement`, `event-no-call`, `event-prevent-twice`, `event-message-body`, `event-message-event`, `event-target-nested`, `event-placeholder` (the whole event passed as an argument, such as `save(e)`), `event-passive-prevent`, `dom-call-position`                                                                                                                                                                |
| Blocks   | `try-catch`, `try-catch-node` (a block the catch view of `<Try>` cannot hold), `subscribe-source`, `subscribe-input-key`, `subscribe-children`, `global-attr`, `global-children`                                                                                                                                                                                                                                                                                                                                     |
| Handlers | `handler-free`, `handler-assign`, `handler-mutate`, `handler-impure`, `handler-generator`, `handler-derived-props` (a derived value whose props paths the payload cannot carry), `handler-derived-stale` (warning: a derived value read after a state write keeps its render-time value), `handler-props-unlisted`, `handler-return-finally`, `helper-module-state` (a helper reassigns a module-level `let`), `await-placement`, `await-callee`, `await-nested`, `await-multiple`, `await-finally`, `await-handler` |
| Codegen  | `codegen-component` (the file has no component), `codegen-event`, `codegen-raw-text` (a bound hole in `<textarea>` or `<title>` that cannot patch), `codegen-unsupported` (a form the code generator does not write yet)                                                                                                                                                                                                                                                                                             |
| Parser   | `parse`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
