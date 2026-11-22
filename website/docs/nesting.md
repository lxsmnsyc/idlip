---
title: Nesting components
order: 13
section: Guide
description: A component renders another one. Props are data, a callback prop is a message for the parent, and each child keeps its own model.
---

A component can render another component that has state and handlers. The child gets its props from the parent, keeps its own model, and sends messages to the parent through callback props. A click inside a child loads only the child's chunks. The samples on this page are `examples/counters`.

## A child component

`Counter` has state (`count`), two props values (`label`, `start`) and one callback prop (`onRemove`):

```tsx
import type { JSX } from 'idlip/jsx-runtime';

export default function Counter(props: {
  label: string;
  start: number;
  onRemove: () => void;
}): JSX.Element {
  let count = props.start;

  function increment() {
    count = count + 1;
  }

  return (
    <div>
      <span>{props.label}</span>
      <button on:click={increment}>+</button>
      <output>{count}</output>
      <button on:click={props.onRemove}>Remove</button>
    </div>
  );
}
```

`increment` is the child's own handler. It changes `count` in the child's model and nothing in the parent's. The `Remove` button puts the callback prop in its event attribute, so the click runs a handler of the parent.

## The parent

`Board` imports `Counter` and renders one per item in a keyed `<For>`:

```tsx
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';
import Counter from './counter.tsx';

interface Item {
  id: string;
  label: string;
  start: number;
}

export default function Board(props: { items: Item[] }): JSX.Element {
  let items = props.items;

  const total = items.length;

  function remove(id: string) {
    items = items.filter((item) => item.id !== id);
  }

  return (
    <main>
      <p>{total} counters</p>
      <For each={items} key="id">
        {(c) => <Counter label={c.label} start={c.start} onRemove={() => remove(c.id)} />}
      </For>
    </main>
  );
}
```

Only the root component goes to `render()` on the server: `render(Board, { items })`. The Vite plugin finds `Counter` because `Board` imports it and renders it in JSX, and compiles it as a child.

## Props are data

A prop is a hole in the closed grammar of [views](./views.md#holes). The parent computes it and the child reads it as `props.label`.

- **A props value** such as `label={c.label}` is copied into the child's slot in the state script. When the parent changes `items`, the binding of `items.*.label` passes the new label to the child, and the child patches its `<span>`.
- **A `let` initial value reads props once.** `let count = props.start` starts the counter at `start`. After that, `count` belongs to the child, and a new `start` from the parent does not reset it.
- **A callback prop** follows the rule of [event attributes](./views.md#events). It is a handler of the parent, or an arrow whose body is one call to a handler. `onRemove={() => remove(c.id)}` compiles to the message `["remove",["a1"],"",""]`. The last item is the model path of the component that owns the handler, `""` for the root. No closure goes to the browser.

## Messages from a child

The child uses a callback prop in an event attribute: `on:click={props.onRemove}`. The server writes the parent's message into the button:

```html
<button on:click='["remove",["a1"],"",""]' i-a="2">Remove</button>
```

A click on it runs `remove("a1")` on the parent's model. The parent patches its count and its list, and the list drops the child's block.

A click on `+` sends `increment` with no path in the attribute. The loader reads the child's path from the boundary around the button and runs `increment` on that child's model.

## Slots

Each child has a slot: its place in the parent, written as a path. The server marks each child with a boundary comment that holds the path:

```html
<!--n:0:a1-->
<div>…</div>
<!--/n-->
```

- **The first part** is the site: the child's position among the child components of the parent's source. `Counter` is the first, so `0`.
- **Inside a `<For>`**, the loop key follows: `0:a1` for the item with `id` `a1`. A keyed reorder keeps each child's model, since the path holds the key.
- **Outside a loop**, a child with no `key` prop is slotted by position alone. A `key` prop adds a part: `<Counter key="left" … />` has the path `0:left`.
- **Deeper levels** join their slots with `/`.

The state script holds one flat table of slots, each with the child's module, model and props:

```json
{
  "0:a1": {
    "module": "/src/counter.tsx",
    "model": { "count": 0 },
    "props": { "label": "Apples", "onRemove": ["remove", ["a1"], "", ""] }
  }
}
```

A parent handler cannot read a child's state. It sees only its own model.

## What the browser loads

A child compiles to its own chunks, as a root does: one per handler and one per binding group. The first click on `+` in a child loads two chunks:

| Chunk                                 | Why                                |
| ------------------------------------- | ---------------------------------- |
| `counter.handler.increment.<hash>.js` | The handler of the click.          |
| `counter.binding.count.<hash>.js`     | The binding of the path it writes. |

No chunk of `Board` loads. A click on `+` in another counter then loads nothing, since both chunks are in the page. The e2e tests in `e2e/tests/nested.spec.ts` count these requests and compare the DOM with a fresh server render after each click and each remove.

A child that a project module renders also gets a `view` chunk. When the parent adds a row in the browser, the list chunk imports it to render the new child. The server render and a click on an existing child never load it.

The loader holds the nesting code behind a build flag. The plugin turns it on when a module renders a child, which adds about 650 B with gzip to the loader. A page with no children does not pay for it.

## Limits

- **A child handler cannot call a callback prop.** `props.onRemove()` inside a handler is the compile error `handler-props-unlisted`. Use the prop in an event attribute, as `Counter` does.
- **A dynamic hole inside a child** binds with its static paths. The read-tracking fallback of the root does not run in a child.
- **A child's model is dropped when its block is removed.** When the block returns, the child starts again from its props. A condition that turns false and then true again does this.
- **On a hot update**, a remounted child keeps its model. Its props come from the fresh render.
- **A child is found only through another idlip module** that imports it and renders it in JSX. The plugin's `modules` option (default `src/**/*.tsx`) must match that parent and the child. A child in a `.tsx` file that the option misses is a build error that names the option.
