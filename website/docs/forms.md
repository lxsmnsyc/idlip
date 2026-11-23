---
title: Forms
order: 22
section: Guide
description: Read form fields when a form submits, keep a field in the model, and reset or focus fields with Dom.
---

A form in idlip has two shapes. In the first, the model holds each field and updates on `input`. In the second, the fields stay in the DOM and the handler reads them on submit, so nothing loads while the user types.

## Read fields on submit

An event arrow can pass a path on the event. On `on:submit`, `e.currentTarget` is the form, and `e.currentTarget.elements` holds its fields by `name`:

```tsx live
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

interface Guest {
  id: string;
  name: string;
  seats: number;
  vegan: boolean;
}

export default function Guests(): JSX.Element {
  let guests = [] satisfies Guest[] as Guest[];

  function add(name: string, seats: number, vegan: boolean) {
    guests = [...guests, { id: `g${guests.length}`, name, seats, vegan }];
  }

  return (
    <main>
      <form
        on:submit={(e) =>
          add(
            e.currentTarget.elements.name.value,
            e.currentTarget.elements.seats.valueAsNumber,
            e.currentTarget.elements.vegan.checked,
          )
        }
      >
        <input name="name" required />
        <input name="seats" type="number" value="1" />
        <label>
          <input name="vegan" type="checkbox" /> Vegan
        </label>
        <button>Add</button>
      </form>
      <ul>
        <For each={guests} key={(guest) => guest.id}>
          {(guest) => (
            <li>
              {guest.name}: {guest.seats} {guest.vegan ? '(vegan)' : ''}
            </li>
          )}
        </For>
      </ul>
    </main>
  );
}
```

- **The arrow reads the paths when it runs**, after the chunk loads. The message holds the values, not the form. A field is read then, so events queued while the chunk loads all send the latest value.
- **`value`, `checked` and `valueAsNumber`** are typed on each field.
- **A `submit` is always prevented**, so the page does not navigate. You do not need `e.preventDefault()`.
- **A field name may be computed.** `e.currentTarget.elements[field].value` is read when the arrow runs.
- **The browser still validates.** A `required` field that is empty stops the submit before the handler runs.

A form in a `<For>` row works the same way. Pass the row's key next to the fields: `on:submit={(e) => rename(item.id, e.currentTarget.elements.text.value)}`.

## Keep a field in the model

Keep the value in state when the view must follow the field as the user types, for example to turn a button on:

```tsx live
import type { JSX } from 'idlip/jsx-runtime';

export default function Search(): JSX.Element {
  let query = '';

  function setQuery(text: string) {
    query = text;
  }

  return (
    <form>
      <input value={query} on:input={(e) => setQuery(e.currentTarget.value)} />
      <button disabled={query === ''}>Search</button>
    </form>
  );
}
```

Each keystroke is a message, so the first one loads the `setQuery` handler and the binding chunk of `query`.

## Reset and focus

`Dom` from `idlip` acts on elements by the name of their `ref`. `Dom.reset` resets a form, or sets one field back to its default value. `Dom.focus` focuses an element:

```tsx live
import { Dom } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

export default function Notes(): JSX.Element {
  let notes = [] satisfies string[] as string[];

  function add(text: string) {
    notes = [...notes, text];
    Dom.reset('note-form');
    Dom.focus('note');
  }

  return (
    <main>
      <form ref="note-form" on:submit={(e) => add(e.currentTarget.elements.note.value)}>
        <input ref="note" name="note" />
        <button>Add</button>
      </form>
      <p>{notes.length} notes</p>
    </main>
  );
}
```

The calls run once, after the page patches for the message. Each call is a statement of its own (`dom-call-position`). Inside a `<For>`, a ref names one row with a tuple: `ref={['row', item.id]}`.

See [idlip](./reference/idlip.md#dom) for `Dom` and [Views](./views.md#events) for event paths.
