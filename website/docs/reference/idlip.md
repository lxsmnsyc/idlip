---
title: idlip
order: 100
section: Reference
description: The block components, raw HTML, refs, impure values and the stock subscription sources that a component imports.
---

`idlip` is what a `*.tsx` module imports. The block components exist only as types: the compiler replaces each use, so calling one throws. The other exports run in the browser or are copied into the chunks that use them.

```tsx no-check
import { For, Try, Head, Subscribe, trusted, Dom, Random, Time, until } from 'idlip';
import { timer, socket, eventSource, media } from 'idlip';
```

## Block components

### `For`

```ts
function For<T>(props: {
  each: readonly T[];
  key: keyof T & string;
  children: (item: T, index: number) => JSX.Element;
}): JSX.Element;
```

Renders `children` once per item of `each`. `key` names a field that is unique among the items. A row patches by key, so a binding of `todos.*.done` touches only the rows whose `done` changed.

```tsx
import { For } from 'idlip';

export default function List(props: { items: { id: string; text: string }[] }) {
  let items = props.items;

  function remove(id: string) {
    items = items.filter((item) => item.id !== id);
  }

  return (
    <ul>
      <For each={items} key="id">
        {(item) => (
          <li>
            {item.text}
            <button on:click={() => remove(item.id)}>Remove</button>
          </li>
        )}
      </For>
    </ul>
  );
}
```

`key` is a string literal (`for-key`). The child is one arrow with an expression body, `(item, index?) => view` (`for-render`). The item may be an object pattern of plain fields.

### `Try`

```ts
function Try(props: {
  catch: (error: unknown, reset: () => void) => JSX.Element;
  children: JSX.Element | readonly JSX.Element[];
}): JSX.Element;
```

Shows `catch` when a binding inside `children` throws, on the server or in a patch. `catch` is an arrow with an expression body and the parameters `error` and, optionally, `reset` (`try-catch`). `reset` is a message target: `on:click={reset}` renders `children` again. The region fires an `idlip:error` event on the document with the error in `detail.error`.

```tsx
import { Try } from 'idlip';

function check(value: number): number {
  if (value < 0) {
    throw new Error(`bad ${value}`);
  }
  return value;
}

export default function Gauge(props: { start: number }) {
  let value = props.start;

  function lower() {
    value = value - 1;
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
      <button on:click={lower}>Lower</button>
    </main>
  );
}
```

### `Head`

```ts
function Head(props: { children: JSX.Element | readonly JSX.Element[] }): JSX.Element;
```

Puts `children` in the document head. It holds elements only, with one `<title>` at most, and they take no events, `ref` or `html`. A `<title>` outside `<Head>` is the error `title-outside-head`. On the server, `renderPage` returns the head markup apart from the body.

```tsx
import { Head } from 'idlip';

export default function Page(props: { name: string }) {
  let name = props.name;

  function rename(next: string) {
    name = next;
  }

  return (
    <main>
      <Head>
        <title>{name}</title>
        <meta name="description" content={`The page of ${name}`} />
      </Head>
      <input value={name} on:input={(e) => rename(e.currentTarget.value)} />
    </main>
  );
}
```

### `Subscribe`

```ts
function Subscribe<I, V>(props: {
  to: (input: I, signal: AbortSignal) => AsyncIterable<V>;
  input: I;
  'on:value': (value: V) => unknown;
}): JSX.Element;
```

Runs the source `to(input, signal)` while the block is on the page and dispatches `on:value` with each value it yields. `to` is an imported or module-level async generator function (`subscribe-source`), and `input` is plain data. When `input` reads state, a `key` prop must read the same paths (`subscribe-input-key`). A new `key` value stops the source and starts it again with the new `input`. The block takes no children.

When the block leaves the page, the signal aborts and the iterator's `return()` is called. The next value is pulled only after the previous one patched, so a slow page does not queue values.

```tsx
import { Subscribe, timer } from 'idlip';

export default function Clock() {
  let now = 0;

  function tick(time: number) {
    now = time;
  }

  return (
    <p>
      <Subscribe to={timer} input={1000} on:value={tick} />
      {now}
    </p>
  );
}
```

## Raw HTML

### `trusted`

```ts
function trusted(html: string): TrustedHtml;
```

Marks a string as safe to write as HTML, for `html={trusted(value)}`. It does not sanitize or escape anything: the call is the trust boundary, so pass only markup you wrote or cleaned. An element with `html` takes no children.

```tsx
import { trusted } from 'idlip';

export default function Note(props: { body: string }) {
  let body = props.body;

  function clear() {
    body = '';
  }

  return (
    <article>
      <div html={trusted(body)} />
      <button on:click={clear}>Clear</button>
    </article>
  );
}
```

### `TrustedHtml`

```ts
type TrustedHtml = string & { readonly __trusted: unique symbol };
```

The type of `html` and of a bound `srcdoc`. A plain string is a type error where it is required, and the compiler reports `html-trusted` for an `html` value that is not a `trusted(...)` call.

## Refs

### `Dom`

```ts
const Dom: {
  focus(ref: RefName): void;
  scrollIntoView(ref: RefName): void;
  measure(ref: RefName): Promise<Rect | null>;
  reset(ref: RefName): void;
};
```

Calls on the elements of the page by the name of their `ref`. In a handler, `focus`, `scrollIntoView` and `reset` run once after the batch's patch, so an element that the same message adds is found. Each call must be a statement of its own (`dom-call-position`). `reset` resets a form, or sets a field back to its default value.

`await Dom.measure(ref)` gives the element's box as a plain `Rect`, so the message log can hold it. A ref that no element has gives a warning in the console, and `measure` resolves to `null`.

```tsx
import { Dom, For } from 'idlip';

export default function Search(props: { items: { id: string; text: string }[] }) {
  let items = props.items;
  let width = 0;

  function add() {
    items = [...items, { id: `i${items.length}`, text: '' }];
    Dom.focus(['row', `i${items.length - 1}`]);
  }
  function focusSearch() {
    Dom.focus('search');
  }
  async function measure() {
    const box = await Dom.measure('search');
    width = box === null ? 0 : box.width;
  }

  return (
    <main>
      <input ref="search" />
      <button on:click={focusSearch}>Search</button>
      <button on:click={measure}>Measure</button>
      <output>{width}</output>
      <ul>
        <For each={items} key="id">
          {(item) => <input ref={['row', item.id]} value={item.text} />}
        </For>
      </ul>
      <button on:click={add}>Add</button>
    </main>
  );
}
```

### `RefName`

```ts
type RefName = string | readonly [string, string | number];
```

A ref name. A string names one element. Inside a `<For>`, a tuple names the element of one row: `ref={['row', t.id]}`, where the second item is the `key` field of the innermost `<For>` (`ref-key`).

### `Rect`

```ts
interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
```

The box of an element, as plain numbers.

## Impure values

A handler may not call an impure function directly (`handler-impure`), since its result enters the model. Await these instead: the loader runs the call and records the value in the message log.

### `Random`

```ts
const Random: {
  id(): Promise<string>;
  number(): Promise<number>;
};
```

`Random.id()` is `crypto.randomUUID()` and `Random.number()` is `Math.random()`.

```tsx
import { For, Random } from 'idlip';

interface Tag {
  id: string;
  label: string;
}

export default function Tags() {
  let tags = [] satisfies Tag[] as Tag[];

  async function add() {
    const id = await Random.id();
    tags = [...tags, { id, label: 'new' }];
  }

  return (
    <main>
      <button on:click={add}>Add</button>
      <ul>
        <For each={tags} key="id">
          {(tag) => <li>{tag.label}</li>}
        </For>
      </ul>
    </main>
  );
}
```

### `Time`

```ts
const Time: {
  now(): Promise<number>;
  sleep(ms: number, signal?: AbortSignal): Promise<void>;
};
```

`Time.now()` is `Date.now()`. `Time.sleep(ms, signal)` waits `ms` milliseconds and rejects when `signal` aborts.

### `until`

```ts
function until<T>(signal: AbortSignal, promise: Promise<T>): Promise<T>;
```

Rejects when the signal aborts, so a subscription source ends its `await` when the block leaves the page. The error is the signal's reason when that is an `Error`, else `new Error('Aborted')`.

```ts
import { until } from 'idlip';

export async function* poll(url: string, signal: AbortSignal) {
  while (!signal.aborted) {
    const response = await until(signal, fetch(url, { signal }));
    yield await until(signal, response.text());
  }
}
```

## Subscription sources

Each source is a function of `(input, signal)` that returns an async generator, for `<Subscribe to={...}>`. The source chunk imports nothing else from the page.

### `timer`

```ts
function timer(ms: number, signal: AbortSignal): AsyncGenerator<number, void, undefined>;
```

Yields `Date.now()` every `ms`. A slow reader gets only the latest tick.

### `socket`

```ts
function socket(
  input: string | SocketInput,
  signal: AbortSignal,
): AsyncGenerator<string, void, undefined>;
```

Yields the text messages of a WebSocket. The buffer holds 100 messages and drops the oldest. The source ends when the socket closes and throws on a socket error.

### `SocketInput`

```ts
interface SocketInput {
  url: string;
  protocols?: string | string[];
}
```

### `eventSource`

```ts
function eventSource(
  input: string | EventSourceInput,
  signal: AbortSignal,
): AsyncGenerator<string, void, undefined>;
```

Yields the data of server-sent events. The buffer holds 100 messages and drops the oldest. The source throws when the stream closes on an error.

### `EventSourceInput`

```ts
interface EventSourceInput {
  url: string;
  /** The event name to listen for. Defaults to `message`. */
  event?: string;
}
```

### `media`

```ts
function media(query: string, signal: AbortSignal): AsyncGenerator<boolean, void, undefined>;
```

Yields whether the media query matches: the current value first, then each change. A slow reader gets only the latest value.

```tsx
import { Subscribe, media } from 'idlip';

export default function Theme() {
  let dark = false;

  function setDark(matches: boolean) {
    dark = matches;
  }

  return (
    <main class={{ dark }}>
      <Subscribe to={media} input="(prefers-color-scheme: dark)" on:value={setDark} />
      {dark ? 'Dark' : 'Light'}
    </main>
  );
}
```
