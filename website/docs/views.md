---
title: Views
order: 11
section: Guide
description: TSX views with holes, events and the block components For, Try, Head and Subscribe.
---

The `return` of a component is its view, written in TSX. A `{...}` in the view is a hole. Each hole is an expression in a closed grammar, so the compiler knows which model paths it reads. When a handler writes one of those paths, the page patches that hole and nothing else.

## Holes

A hole fills text, an attribute or a property:

```tsx live
import type { JSX } from 'idlip/jsx-runtime';

function double(n: number): number {
  return n * 2;
}

export default function Profile(props: { url: string }): JSX.Element {
  let name = 'Ada';
  let count = 1;

  function rename(text: string) {
    name = text;
    count = count + 1;
  }

  return (
    <section>
      <h2 title={`Profile of ${name}`}>{name.toUpperCase()}</h2>
      <p>
        Renamed {count} {count === 1 ? 'time' : 'times'}, doubled {double(count)}
      </p>
      <input value={name} on:input={(e) => rename(e.currentTarget.value)} />
      <a href={props.url}>Home</a>
    </section>
  );
}
```

```json live props.json
{
  "url": "https://example.com/ada"
}
```

A hole may hold:

- **Values**: literals, template literals, arrays and object literals.
- **Names**: state, derived values, props, loop variables and module-level constants, with property paths such as `todo.text`, `items[0]?.label` and `name.length`.
- **Operators**: `!`, `-`, `+`, `typeof`, comparisons, arithmetic, `&&`, `||`, `??` and `? :`.
- **Helpers**: a call to an import or a module-level function, such as `double(count)` or `countLeft(todos)`. `String`, `Number`, `Boolean` and the `Math` functions other than `Math.random` are allowed too.
- **Methods** that change nothing and take no function: `trim`, `toUpperCase`, `toLowerCase`, `slice`, `includes`, `startsWith`, `endsWith`, `indexOf`, `join`, `at`, `padStart`, `padEnd` and `toFixed`.

Anything else, such as `JSON.stringify(items)` or `window.innerWidth`, goes in a module-level helper.

### Class and style

`class` takes a string or an object of booleans. `style` takes a string or an object of values:

```tsx live
import type { JSX } from 'idlip/jsx-runtime';

export default function Panel(): JSX.Element {
  let open = false;

  function toggle() {
    open = !open;
  }

  return (
    <div class={{ panel: true, open }} style={{ height: open ? '20rem' : '3rem' }}>
      <button on:click={toggle}>{open ? 'Close' : 'Open'}</button>
    </div>
  );
}
```

### URLs and raw HTML

- **URL attributes** such as `href` and `src` drop a bound `javascript:` or `vbscript:` URL. A literal in the source is written as is.
- **Raw HTML** goes in the `html` attribute, and only through `trusted(value)` from `idlip`. `trusted` marks the one place where you vouch for the markup. A bound `srcdoc` follows the same rule.

```tsx live
import { trusted } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

export default function Article(props: { body: string }): JSX.Element {
  return <article html={trusted(props.body)} />;
}
```

```json live props.json
{
  "body": "<p>An article with <em>markup</em>.</p>"
}
```

## Conditions

Write a condition with `&&` or `? :`. A branch can be markup, text or `null`:

```tsx live
import type { JSX } from 'idlip/jsx-runtime';

export default function Notice(): JSX.Element {
  let shown = true;
  let count = 0;

  function hide() {
    shown = false;
  }
  function add() {
    count = count + 1;
  }

  return (
    <div>
      {shown && <p on:click={hide}>Click to hide</p>}
      {count === 0 ? <p>Nothing yet</p> : <p>{count} added</p>}
      <button on:click={add}>Add</button>
    </div>
  );
}
```

## Events

An event attribute is `on:` and the event name: `on:click`, `on:input`, `on:submit`. It takes a handler, or an arrow that sends messages to handlers.

The counter and the todo app use all three forms:

| Attribute                                           | Message                                                      |
| --------------------------------------------------- | ------------------------------------------------------------ |
| `on:click={increment}`                              | `increment` with no arguments.                               |
| `on:click={() => toggle(t.id)}`                     | `toggle` with `t.id`, read from the row when the event runs. |
| `on:input={(e) => setDraft(e.currentTarget.value)}` | `setDraft` with the value of the field when the event runs.  |

- **An arrow is a function in the handler chunk.** It runs after the event has dispatched, once the chunk has loaded. It reads the event, the state, the props and the row, and it sends a message to each handler it calls. The HTML holds only the name of the function. It reads the element then, so events queued while the chunk loads all send the latest value of a field.
- **A body may hold** handler calls, `if` and `else` on any expression of the view, and `const` declarations. It may call several handlers, or none in some branches. At least one call must be in the arrow (`event-no-call`).
- **Arguments** are expressions. `e.currentTarget.value` and `e.key` read the event, and `t.id` reads the row the user clicked.
- **`e.preventDefault()` and `e.stopPropagation()`** go first, since the browser must see them while the event dispatches. The compiler lifts them to the page.
- **A conditional prevent** is an `if` on the key at the start, with no call inside: `if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); }`. The page prevents those keys at once, and the arrow still runs for every key.
- **A key test** may wrap the whole arrow: `if (e.key === 'Escape') { clear(); }`. The test can also check `e.ctrlKey`, `e.shiftKey`, `e.altKey` and `e.metaKey`. The listener runs the test, so a key that does not match loads nothing.

### Forms

A `submit` is always prevented, so the page does not navigate. Read the fields by name from `e.currentTarget.elements`:

```tsx live
import type { JSX } from 'idlip/jsx-runtime';

export default function Signup(): JSX.Element {
  let name = '';

  function save(text: string) {
    name = text;
  }

  return (
    <form on:submit={(e) => save(e.currentTarget.elements.name.value)}>
      <input name="name" />
      <button>Save</button>
      <p>Saved: {name}</p>
    </form>
  );
}
```

A field name may be computed: `e.currentTarget.elements[field].value` reads the field when the event runs.

## Block components

Four components from `idlip` mark blocks in the view. The compiler replaces them, so they never run.

### For

`<For>` renders a list. `each` is the array, and `key` is a callback of the item that returns a string or number, unique among the items: `key={(step) => step.id}`. The child is a function of the item and its index:

```tsx live
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

export default function Steps(props: { steps: { id: string; label: string }[] }): JSX.Element {
  return (
    <ol>
      <For each={props.steps} key={(step) => step.id}>
        {(step, index) => <li data-index={index}>{step.label}</li>}
      </For>
    </ol>
  );
}
```

```json live props.json
{
  "steps": [
    {
      "id": "s1",
      "label": "Install"
    },
    {
      "id": "s2",
      "label": "Write"
    },
    {
      "id": "s3",
      "label": "Ship"
    }
  ]
}
```

A row moves with its key when the list changes. The key body is one expression that reads the item and nothing else. `key="id"` is the error `for-key`, which names the callback form.

Only a key that is one field of the item, `step.id`, keeps keyed writes: a write set can name one row (`steps[id=selected].done`). A computed key moves the rows by key all the same. Computed keys are a nested field (`step.meta.id`), a template literal (`` `${step.kind}:${step.id}` ``) or another expression of the closed grammar. Their write sets treat the row as any row (`steps.*.done`), so a change to the list loads the list chunk and runs the row bindings of every row. That patches more than needed and never less. `.map()` in a view is the error `view-map`.

### Try

`<Try>` shows `catch` when a hole inside it throws. `catch` gets the error and a `reset` function to try again:

```tsx live
import { Try } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

function check(value: number): number {
  if (value < 0) {
    throw new Error(`bad value ${value}`);
  }
  return value;
}

export default function Meter(): JSX.Element {
  let value = -1;

  function increment() {
    value = value + 1;
  }

  return (
    <main>
      <Try
        catch={(error, reset) => (
          <p>
            Failed: {error} <button on:click={reset}>Retry</button>
          </p>
        )}
      >
        <output>{check(value)}</output>
      </Try>
      <button on:click={increment}>+1</button>
    </main>
  );
}
```

### Head

`<Head>` puts elements in the document `<head>`. It holds elements and at most one `<title>`. A hole in a `<title>` must be its only content:

```tsx live
import { Head } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

export default function Inbox(): JSX.Element {
  let unread = 3;

  const label = `Inbox (${unread})`;

  function read() {
    unread = 0;
  }

  return (
    <main>
      <Head>
        <title>{label}</title>
        <meta name="description" content="Your messages" />
      </Head>
      <button on:click={read}>Mark all read</button>
    </main>
  );
}
```

`renderToResponse()` and `renderToStream()` of `idlip/server` write the head elements into `<head>`. See [Document head](./head.md).

### Subscribe

`<Subscribe>` reads a stream of values while it is in the view and sends each value to a handler. See [Subscriptions](./subscriptions.md) and [Effects](./effects.md).

## Common errors

Each rule is a compile error with this id:

| Rule id             | Cause                                                                |
| ------------------- | -------------------------------------------------------------------- |
| `view-map`          | `.map()` in a view. Use `<For each key>`.                            |
| `hole-global`       | A global such as `JSON` or `window` in a hole. Wrap it in a helper.  |
| `hole-method`       | A method outside the list above, such as `date.getTime()`.           |
| `jsx-spread`        | A spread attribute, `<div {...attrs} />`.                            |
| `event-closure`     | An `async` event arrow, or a statement that is not a handler call.   |
| `event-statement`   | A statement other than a call, `if`, `else` or `const` in an arrow.  |
| `event-no-call`     | An event arrow that calls no handler.                                |
| `event-placeholder` | The whole event passed as an argument, such as `save(e)`.            |
| `attr-event`        | An `onclick` attribute. Use `on:click`.                              |
| `html-trusted`      | `html={value}` without `trusted(...)`.                               |
| `srcdoc-trusted`    | A bound `srcdoc` without `trusted(...)`.                             |
| `hole-dynamic`      | A hole whose model paths the compiler cannot find and cannot record. |

A helper that takes the whole `props`, or an object of state fields, is not an error. At the top level of a root component, the server records the paths the helper reads and sends them with the state. Inside `<For>`, a condition, a `<Try>` or a child component, the hole uses the paths the compiler finds.

```tsx no-check
<button onclick="save()">Save</button>                // attr-event
<div html={props.body} />                             // html-trusted
<input on:input={(e) => setDraft(e)} />               // event-placeholder
<ul>{todos.map((t) => <li>{t.text}</li>)}</ul>        // view-map
```
