---
title: Components and state
order: 10
section: Guide
description: A module is a function component. let is state, const is derived, function declarations are handlers and return is the view.
---

An idlip module is a `*.idlip.tsx` file whose default export is a function component. The compiler reads the body and never runs it. Each declaration form has one meaning:

| Source             | Meaning                                                      |
| ------------------ | ------------------------------------------------------------ |
| `let x = v`        | State: field `x` of the model, with initial value `v`.       |
| `const d = expr`   | A derived value, computed from state and props.              |
| `function h(a, b)` | A handler: message `h` with payload `[a, b]`, and one chunk. |
| `return <jsx>`     | The view.                                                    |

Nothing is imported only to mark these. The block components of [views](./views.md#block-components) are the one exception.

## A counter

```tsx
import type { JSX } from 'idlip/jsx-runtime';

export default function Counter(props: { start: number }): JSX.Element {
  let count = props.start;

  const even = count % 2 === 0;

  function increment() {
    count = count + 1;
  }
  function add(step: number) {
    count = count + step;
  }
  function reset() {
    count = props.start;
  }

  return (
    <div>
      <button on:click={increment}>+1</button>
      <button on:click={() => add(10)}>+10</button>
      <button on:click={reset}>Reset</button>
      <output class={{ even }}>{count}</output>
      {even && <span>even</span>}
    </div>
  );
}
```

The model of this component is `{ count }`. A click on `+10` sends the message `add(10)`. The `add` handler returns the next model, and the page patches the `<output>` and the `even` span.

## The body

The body is a list of declarations: `let`, `const`, function declarations and one `return`. Any other statement is the error `body-statement`.

```tsx no-check
export default function Counter() {
  let count = 0;
  console.log(count); // body-statement
  function increment() {
    count = count + 1;
  }
  return <button on:click={increment}>{count}</button>;
}
```

Put setup code in a helper at module level and call it from an initial value or a derived value.

## State

Each `let` is a field of one model value. Its initial value can read props, imports and module-level constants.

- **Types come from the initial value.** `let count = 0` is a `number`.
- **A wider type** is written `let x = v satisfies T as T`. `satisfies T` checks the initial value, and `as T` widens the type for the handlers.
- **Assign to change state.** A handler writes `todos = [...todos, item]`. A call that changes the value in place, such as `todos.push(item)`, is the error `handler-mutate`.
- **A `let` that is never assigned** is the warning `let-unassigned`. Make it a `const`.

A lifecycle fits in one union:

```tsx
import type { JSX } from 'idlip/jsx-runtime';

type Save = { state: 'idle' } | { state: 'saving' } | { state: 'failed'; error: string };

export default function Saver(): JSX.Element {
  let save = { state: 'idle' } satisfies Save as Save;

  function start() {
    save = { state: 'saving' };
  }
  function fail(error: string) {
    save = { state: 'failed', error };
  }
  function retry() {
    start();
  }

  return (
    <div>
      <button on:click={start} disabled={save.state === 'saving'}>
        Save
      </button>
      <button on:click={() => fail('Offline')}>Fail</button>
      {save.state === 'failed' ? (
        <p>
          {save.error} <button on:click={retry}>Retry</button>
        </p>
      ) : null}
    </div>
  );
}
```

Two other forms are errors, because TypeScript narrows them in the view:

```tsx no-check
let save: Save = { state: 'idle' }; // let-annotation
let save = { state: 'idle' } as Save; // let-bare-as
```

With `let save: Save = { state: 'idle' }`, TypeScript narrows `save` to `{ state: 'idle' }` in the view, so `save.state === 'saving'` is a type error. A bare `as Save` hides a wrong initial value.

The model goes to the browser in the state script, serialized with seroval. Keep state to data: strings, numbers, booleans, arrays and plain objects.

## Derived values

A `const` is computed from state, props and other derived values. The compiler copies its expression into the view and into each handler that reads it, so it is never stored in the model.

```tsx
import type { JSX } from 'idlip/jsx-runtime';

export default function Cart(props: { price: number }): JSX.Element {
  let count = 1;

  const total = count * props.price;
  const size = total > 100 ? 'large' : 'small';

  function increment() {
    count = count + 1;
  }

  return (
    <p>
      {count} items, {total} ({size}) <button on:click={increment}>+1</button>
    </p>
  );
}
```

A loop goes in a module-level helper, such as `countLeft(todos)` in the todo app. The helper takes state as arguments, so the compiler still knows which model paths the value reads.

## Handlers

A handler is a function declaration in the body. Its name is the message tag, and the compiler puts it in a chunk of its own. The todo app has four handlers and four handler chunks: `setDraft`, `clear`, `add` and `toggle`.

- **The body is TypeScript** and runs only in the browser.
- **State changes** only by assignment to a `let`.
- **A handler may call another handler.** The call runs as part of the same message, as `retry()` calls `start()` above.
- **Free variables** are state, derived values, props, other handlers, imports and module-level declarations.
- **Handlers are deterministic.** `Math.random()`, `Date.now()`, `performance.now()`, `crypto.randomUUID()`, `crypto.getRandomValues()` and `new Date()` with no arguments are the error `handler-impure`.

The compiled `toggle` of the todo app is a pure function from the model and the payload to the next model:

```ts
export function toggle(model, [id]) {
  let { todos } = model;
  todos = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  return { ...model, todos };
}
```

A message is plain data: the handler name and its arguments, `{ t: 'toggle', p: ['a1'] }`. The server writes `["toggle",["a1"]]` into the `on:click` attribute of the first checkbox, so a click runs no closure from the page.

## Props

A component takes one parameter, `props`, or an object pattern of it:

```tsx
export default function Greeting({ name }: { name: string }) {
  return <p>Hello, {name}</p>;
}
```

The server passes the props of the root component: `render(TodoApp, { initial })` from `idlip/server`. They go into the state script with the model, so they must serialize too.

## Common errors

| Rule id          | Cause                                                              |
| ---------------- | ------------------------------------------------------------------ |
| `body-statement` | A statement in the body that is not a declaration or `return`.     |
| `let-annotation` | `let x: T = v`. Write `let x = v satisfies T as T`.                |
| `let-bare-as`    | `let x = v as T`. Write `let x = v satisfies T as T`.              |
| `let-unassigned` | A `let` that no handler assigns. A warning. Use `const`.           |
| `handler-mutate` | A handler changes state in place, such as `todos.push(x)`.         |
| `handler-impure` | A handler calls `Math.random()`, `Date.now()` or a similar global. |

[Views](./views.md) lists the errors of the view.
