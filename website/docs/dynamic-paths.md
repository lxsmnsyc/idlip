---
title: Dynamic paths
order: 24
section: Guide
description: How the compiler finds the model paths of a hole, and what happens when a helper reads fields it cannot see.
---

Each hole patches when a model path it reads changes. Most of the time the compiler finds those paths in the source. When it cannot, the server records what the hole reads while it renders.

## Paths the compiler finds

The compiler reads the hole and the helpers it calls:

- **A name or a property path**, such as `{draft}` or `{todo.text}`, reads that path.
- **A helper whose body is one `return` of an expression** in the hole grammar is read through. `isDone(todo)` that returns `todo.done` reads `todo.done`, not all of `todo`.
- **Any other helper**, such as one with a loop, reads the paths of its arguments. `countLeft(todos)` reads `todos`, so a write anywhere under `todos` patches it.

```tsx live
import type { JSX } from 'idlip/jsx-runtime';

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}

export default function Cart(): JSX.Element {
  let count = 1;
  let note = '';

  function add() {
    count = count + 1;
  }
  function setNote(text: string) {
    note = text;
  }

  return (
    <main>
      <p>
        {count} {plural(count, 'item')}
      </p>
      <input value={note} on:input={(e) => setNote(e.currentTarget.value)} />
      <button on:click={add}>Add</button>
    </main>
  );
}
```

`plural(count, 'item')` reads `count`, so typing in the field does not touch it.

## Paths the server records

A helper can take an object built from several state fields, and read only some of them:

```tsx live
import type { JSX } from 'idlip/jsx-runtime';

interface View {
  mode: string;
  a: string;
  b: string;
}

function pick(view: View): string {
  return view.mode === 'a' ? view.a : view.b;
}

export default function Pick(): JSX.Element {
  let mode = 'a';
  let a = 'first';
  let b = 'second';

  const view = { mode, a, b };

  function setMode(value: string) {
    mode = value;
  }
  function setA(value: string) {
    a = value;
  }
  function setB(value: string) {
    b = value;
  }

  return (
    <main>
      <p>{pick(view)}</p>
      <button on:click={() => setMode('b')}>Mode b</button>
      <button on:click={() => setA('first!')}>A</button>
      <button on:click={() => setB('second!')}>B</button>
    </main>
  );
}
```

The compiler cannot tell which fields `pick` reads, so `{pick(view)}` is a dynamic hole. The same holds for a stateless component that passes its whole `props` to a helper.

- **On the server**, the hole runs on a proxy of the model. Each field it reads is recorded, and the list goes to the browser with the state. Here it is `mode` and `a`.
- **In the browser**, a patch runs the hole only when one of its recorded paths changed. A click on B does not run it, since it did not read `b`.
- **Reads can change.** After `setMode('b')` the hole runs again and records `mode` and `b`, so B now patches it.

All dynamic holes of a module share one binding chunk, `$dynamic`. Every handler that writes a path loads it with the handler chunk, whether a hole read that path or not.

### Read precisely

- An array index records as `*`: reading `todos[0].done` records `todos.*.done`.
- `in`, `Object.keys` and a spread record the whole object, `todos.*`, so a key added later counts as a change.
- A `Map`, `Set` or `Date` is not looked into. Reading one records its path as a whole.

## Inside rows, branches and children

Inside a `<For>`, a condition, a `<Try>` or a child component, a dynamic hole uses the paths the compiler finds in its arguments instead. For `pick(view)` in a row that is `mode`, `a` and `b`: the hole runs on any change to one of them. The result is right but the hole runs more often.

## Errors

- **`props-whole`**: a stateless component reads its props by a computed key, such as `props[props.field]`. Read each prop by name.
- **`hole-dynamic`**: a hole whose paths the compiler cannot find and the server cannot record. It is rare: move the value into a `const` or a helper of its own.

See [Component syntax](./reference/syntax.md) for the hole grammar.
