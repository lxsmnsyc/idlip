# 0004: Effects, files, refs, error boundaries and other gaps

Status: draft

This proposal fills gaps found by a feature review of the core roadmap on 2026-11-20. Revised 2026-11-21 for function components and the rule against compile-time APIs in [0002](0002-modules.md): `task()`, `defineSub()` and the `catch` and `head` module properties are removed, and subscriptions, error boundaries and the head become block components.

## Decisions

- **Effects are `await` in a handler.** An async handler awaits an imported or module-level async function. The compiler runs the call as a task on the client and dispatches the rest of the handler as a continuation message. Impure values such as random IDs and the time come the same way (0002, Rules).
- **Subscriptions are in the view.** `<window>`, `<document>` and `<Subscribe>` start when the block they sit in is added and stop when it is removed, like brumate's `<window>` and `<document>` elements. A source is a module-level async generator. Settled by `docs/roadmaps/core/debates/subscriptions/debate.md`.
- **Error boundaries are `<Try>`,** placed anywhere in the markup, like brumate's `#try … #catch`.
- **The head is `<Head>`,** placed anywhere in the markup, like brumate's `#head`.
- **Files** may be held in state on the client. They leave the client only as form data parts, as in brumate.
- **Refs.** A `ref` attribute names an element. Runtime functions called in handlers take the name, and the runtime resolves it to the element.
- **SVG and MathML** keep their namespace in templates and item templates.
- **Raw HTML** goes through `html={trusted(value)}`. A plain string is a type error.
- **Imported and module-level constants** are allowed in holes. Their path set is empty.

`<Try>`, `<Head>` and `<Subscribe>` are block components for the proof of concept, as `<For>` is. The markup DSL replaces them with blocks that produce the same view IR nodes. See [0002](0002-modules.md), Decisions.

## Effects

```ts
// api.ts
export async function loadUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as User;
}
```

```tsx
// profile.idlip.tsx
import { loadUser } from './api';

type UserState =
  | { state: 'notAsked' }
  | { state: 'loading'; id: string }
  | { state: 'failure'; error: string }
  | { state: 'success'; user: User };

export default function Profile() {
  let user = { state: 'notAsked' } satisfies UserState as UserState;

  async function open(id: string) {
    user = { state: 'loading', id };
    try {
      user = { state: 'success', user: await loadUser(id) };
    } catch (error) {
      user = { state: 'failure', error: String(error) };
    }
  }

  return ...;
}
```

- `open("u1")` runs up to the `await` as one message, so the view shows the loading state at once.
- `loadUser(id)` runs on the client as a task, in its own chunk. When it settles, the runtime dispatches the continuation `open$1` with the result or the error as payload. The continuation runs the `try` or the `catch` branch.
- The lifecycle is one explicit union that the handler sets. The runtime adds no hidden state.
- `tsc` checks the call and the result types as ordinary TypeScript. There is no `Result<T>` and no constructor to pass.
- Tasks run only on the client. Handlers never run on the server, so the server never runs a task. Data loading on the server stays a non-goal.
- Built-in effects are plain functions too. A handler calls `fetch`, `localStorage` or a library through an async function that it awaits. idlip ships no `Http` or `Storage` commands.

Prior art: brumate runs an async handler whole in the browser as a closure, and splits only a browser render at `await` into a continuation (`$$b.wait`, `../brumate/docs/decisions.md`). idlip splits handlers, because a continuation must be a named message with a serializable payload. Elm's `Task.attempt GotUser` and Iced's `Task::perform(future, Message::Loaded)` are the same split, written by hand.

## Files

`File` and `Blob` values can be held in state on the client, for example `let upload = { state: 'none' } satisfies Upload as Upload` with `{ state: 'picked'; file: File }` as one of the cases.

- The server never has a file. A server render whose model holds a blob throws, as brumate's page state does.
- A file leaves the client only as a part of multipart form data. `@seroval/transport/web` has `toFormRequest` and `fromFormRequest`: each file or blob anywhere in the value gets its own form field, and the value holds only its index, type, name and `lastModified`. Brumate does the same in `uploadPlugin` (`../brumate/packages/brumate/src/runtime/serial.ts`) and `../brumate/packages/brumate/src/runtime/rpc.ts`.
- An upload is an async function that sends a request built with `toFormRequest`, awaited in a handler.
- HMR sends the model to the server with `toFormRequest` too, so a model that holds a file keeps it across a markup edit.

## Subscriptions

Settled by the debate in `docs/roadmaps/core/debates/subscriptions/debate.md`, approved 2026-11-21.

A subscription is a node in the view. It starts when the block it sits in is added and stops when the block is removed. The state that turns it on is an explicit union in the model, and no handle is kept by hand.

```tsx
import { Subscribe, Time } from 'idlip';

type ClockState = { state: 'stopped' } | { state: 'running'; ticks: number };

async function* every(ms: number, signal: AbortSignal) {
  while (true) {
    await Time.sleep(ms, signal);
    yield await Time.now();
  }
}

export default function Clock() {
  let clock = { state: 'stopped' } satisfies ClockState as ClockState;
  function start() { clock = { state: 'running', ticks: 0 }; }
  function stop() { clock = { state: 'stopped' }; }
  function tick(now: number) { if (clock.state === 'running') clock = { ...clock, ticks: clock.ticks + 1 }; }
  function key(name: string) { if (name === 'Escape') stop(); }
  function move(x: number) { ... }

  return (
    <main>
      <window on:keydown={(e) => key(e.key)} latest:pointermove={(e) => move(e.clientX)} />
      {clock.state === 'running' && <Subscribe to={every} input={1000} on:value={tick} />}
      <button on:click={start}>Start</button>
    </main>
  );
}
```

### Window and document events

- `<window>` and `<document>` take event props like any element. The loader delegates their listeners. They need no source chunk and no marker, and ship before `<Subscribe>`.
- Every event queues by default and keeps its own value, as `compiled-format` requires for queued `input` events.
- `latest:name={...}` opts into latest-wins: while the handler's chunk loads or a patch runs, a new event replaces the pending one for the same element and event name. Use it for `pointermove`, `scroll` and `resize`. `on:x` and `latest:x` on one element is a compile error. `latest:` works on any element.
- Dev builds warn when an element's pending queue grows deep, naming the event.

### `<Subscribe>`

- `<Subscribe to={source} input={value} on:value={handler}>` runs `source(input, signal)`, an async generator declared at module level or imported. A source with several parameters takes one input object. `tsc` checks `input` against the source and the yielded type against the handler.
- **Input is read once at start.** A new run needs a new `key` or a remount through the condition. The runtime never compares inputs. The compiler rejects an `input` that reads state unless `key` reads the same state, so a stale input cannot go unnoticed.
- **Delivery is pull-based.** The loader asks the source for its next value only after the previous message has patched, so each subscription has one value in flight and the source decides what to drop. Stock sources: the timer yields the latest tick, and the socket source keeps a buffer of 100 and drops the oldest.
- **Each value is an ordinary message** with the value as its payload, so it is in the message log and replay never runs the source again. Dev builds check at dispatch that the payload serializes.
- **Stop.** When the block is removed, the runtime aborts the signal, calls `return()` without awaiting it, and drops any later yield, so no handler runs after the block is gone. Cleanup is prompt only for sources that end their awaits on the signal. Stock sources do. Custom sources use `until(signal, promise)` or `Time.sleep(ms, signal)`, which reject on abort. Dev builds warn when `return()` has not settled 1000 ms after the abort.
- **Resume.** The server renders a marker for each active `<Subscribe>`, with the source chunk id and the serialized input. The loader starts the sources whose markers are in the page. A page without subscriptions loads nothing for them, and a stopped source leaves no marker.
- An error thrown by a source goes to the nearest `<Try>`.
- Stock sources: timer, WebSocket, EventSource and media query, shipped as plain async generators.

### Block hook and log

- Start and stop run on one block add/remove hook, owned by `patch-bindings` and shared with `<For>` rows, `<Head>` and `<Try>`. Starting a source is not awaited by `patch()`.
- The dev message log is a ring of 1000 messages, each with its recorded model. Replay starts from the oldest kept entry. Production keeps no log.

### Accepted risks

- A custom source that does not observe its signal keeps its socket or listener open after stop. No static check can see it; dev builds warn.
- A fast event without `latest:` queues every event, about 30 during a 500 ms cold chunk load at 60 Hz. Dev builds warn on queue depth.

Rejected, with reasons in the debate: a `for await` loop in a handler, a declaration in the component body, a self-scheduling timer, restarting when the input changes, and latest-wins by default.

Prior art: brumate's `<window>` and `<document>` elements, Svelte's `<svelte:window>`, Elm's `subscriptions`.

## Error boundaries

```tsx
<Try catch={(error, reset) => <p>The chart failed. <button on:click={reset}>Retry</button></p>}>
  <Chart rows={rows} />
</Try>
```

- `<Try>` may sit anywhere in the markup, including inside conditions and `<For>` rows.
- On the server, when a hole, helper or child component inside it throws, the server renders the `catch` view in its place.
- On the client, when a binding inside it throws while patching, or a subscription source inside it throws, the runtime replaces its region with the `catch` view. The model is kept, and `idlip:error` fires with the component path.
- `reset` renders the body again from the current model.
- The `catch` view may read state, props and `error`. Its holes follow the closed grammar.
- A chunk that fails to load is retried once, then fires `idlip:error`, which `deploy-skew` can handle. A handler that throws keeps the model.

## Document head

```tsx
<Head>
  <title>{left} left</title>
  <meta name="description" content={summary} />
</Head>
```

These are brumate's rules (`../brumate/docs/decisions.md`):

- `<Head>` may sit in any component, anywhere in the markup, including inside conditions and loops. Its `<meta>` and `<link>` elements go in `<head>` and are added and removed with the block they sit in.
- With several titles in the page, the last one wins. The runtime sets `document.title` from the last title whenever a block adds or removes one or its text changes. When none is left, the title stays.
- The server writes the last title first in `<head>`, for readers without scripts.
- `<title>` outside `<Head>` is a compile error, except inside `<svg>`.

## Refs

```tsx
<input ref="search" value={query} on:input={(e) => setQuery(e.currentTarget.value)} />
<For each={rows} key="id">
  {(row) => <tr ref={['row', row.id]}>...</tr>}
</For>
```

- A ref name is a string literal, or a tuple of a literal and a loop variable path inside `<For>`. It is local to the component instance.
- Handlers call runtime functions with the name: `Dom.focus('search')`, `Dom.scrollIntoView(['row', id])`, `await Dom.measure('chart')`. They resolve the name to the element in the current DOM.
- `Dom.focus` from [0003](0003-update-analysis.md) takes a ref name instead of a selector.

## SVG, MathML and raw HTML

- Elements inside `<svg>` and `<math>` keep their namespace. A `<For>` or condition block inside them gets a template parsed in that context, so rows created on the client use the right namespace.
- `html={trusted(value)}` sets the element's content from a string. `trusted()` is a runtime function that returns a branded `TrustedHtml`, so a plain string is a type error. The element must have no children. The server writes the string as is, and the patcher sets `innerHTML`.

## Constants in holes

A hole may read imported values and module-level `const` bindings, such as `class={styles.item}` from a CSS module or an icon map. Their path set is empty, so they render once on the server and never patch.

## Open questions

- **Transitions.** Enter and exit animations for condition blocks and list items. Later.
- **Custom elements.** Hosting widgets as custom elements, with rules for attributes and properties. A ref and an awaited setup function cover the same need for now.
