---
title: Refs
order: 32
section: Guide
description: A ref names an element. Handlers focus, scroll, reset and measure it with Dom calls that take the name.
---

A `ref` attribute names an element. A handler calls a `Dom` function with the name, and the runtime finds the element in the current page. No element object is kept in state, so the model stays plain data.

## Focus, reset and measure

```tsx
import { Dom, For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

interface Row {
  id: string;
  text: string;
}

export default function Rows(props: { rows: Row[] }): JSX.Element {
  let rows = props.rows;
  let width = 0;

  function add() {
    rows = [...rows, { id: `r${rows.length}`, text: '' }];
    Dom.focus(['row', `r${rows.length - 1}`]);
  }
  function clear() {
    Dom.reset('form');
    Dom.focus('search');
  }
  async function measure() {
    const box = await Dom.measure('search');
    width = box === null ? 0 : box.width;
  }

  return (
    <main>
      <form ref="form">
        <input ref="search" />
      </form>
      <button on:click={add}>Add</button>
      <button on:click={clear}>Clear</button>
      <button on:click={measure}>Measure</button>
      <p>{width}</p>
      <ul>
        <For each={rows} key="id">
          {(row) => <li ref={['row', row.id]}>{row.text}</li>}
        </For>
      </ul>
    </main>
  );
}
```

The test `packages/idlip/test/client/dom/dom.test.ts` runs these calls on `packages/idlip/test/fixtures/refs/refs.idlip.tsx`.

## Ref names

- A ref name is a string literal: `ref="search"`.
- Inside `<For>`, a ref is a tuple of a literal and the row's key: `ref={['row', row.id]}`, where `id` is the `key` of the `<For>`. Any other second item is the error `ref-key`, because only the key is unique among the rows.
- A handler passes the same name: `Dom.focus('search')`, `Dom.focus(['row', id])`.

## The Dom calls

| Call                      | Effect                                                                 |
| ------------------------- | ---------------------------------------------------------------------- |
| `Dom.focus(ref)`          | Focuses the element.                                                   |
| `Dom.scrollIntoView(ref)` | Scrolls the element into view.                                         |
| `Dom.reset(ref)`          | Resets a form, or sets an input or textarea back to its default value. |
| `await Dom.measure(ref)`  | Gives the element's box as `{ x, y, width, height }`, or `null`.       |

`focus`, `scrollIntoView` and `reset` do not run where they are written. The compiler collects them, and they run once after the batch's patch. So `add` above can focus a row that the same message adds. Each of these calls must be a statement of its own (`dom-call-position`): it returns nothing to read.

`Dom.measure` is awaited like any [effect](./effects.md#built-in-values). It is built in, so its code sits in the handler chunk and its continuation runs in the same batch. The box is plain numbers, so the continuation's payload stays plain data.

A name that no element has gives the console warning `idlip: no ref <name>`. The call does nothing, and `measure` resolves to `null`.

## Server, resume and unmount

- **Server.** The server writes the name as an `i-ref` attribute: `<input i-ref="search">`, and `i-ref="row r0"` for a tuple. Nothing else is serialized.
- **Resume.** Nothing is restored. A call looks up the `i-ref` attribute inside the component when it runs, so it finds what the page shows at that time.
- **Patch.** The collected calls run only when the batch's patch succeeded. A patch that throws drops them.
- **Unmount.** A removed element takes its `i-ref` with it. A later call to that name warns and does nothing.

Refs add about 550 B gzip to the loader, only in apps whose handlers call `Dom.focus`, `Dom.scrollIntoView` or `Dom.reset`.

## Common errors

| Rule id             | Cause                                                                              |
| ------------------- | ---------------------------------------------------------------------------------- |
| `ref-form`          | `ref` is not a string literal, or a `[literal, path]` tuple inside `<For>`.        |
| `ref-key`           | The second item of a tuple ref is not the key of the enclosing `<For>`.            |
| `dom-call-position` | `Dom.focus`, `Dom.scrollIntoView` or `Dom.reset` used as a value, not a statement. |
