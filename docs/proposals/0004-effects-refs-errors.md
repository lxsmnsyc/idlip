# 0004: Effects, files, refs, error boundaries and other gaps

Status: draft

This proposal fills gaps found by a feature review of the core roadmap on 2026-11-20. Revised 2026-11-21 for function components and the rule against compile-time APIs in [0002](0002-modules.md): `task()`, `defineSub()` and the `catch` and `head` module properties are removed.

## Decisions

- **Effects are `await` in a handler.** An async handler awaits an imported or module-level async function. The compiler runs the call as a task on the client and dispatches the rest of the handler as a continuation message.
- **Files** may be held in state on the client. They leave the client only as form data parts, as in brumate.
- **Refs.** A `ref` attribute names an element. Runtime functions called in handlers take the name, and the runtime resolves it to the element.
- **SVG and MathML** keep their namespace in templates and item templates.
- **Raw HTML** goes through `html={trusted(value)}`. A plain string is a type error.
- **Imported and module-level constants** are allowed in holes. Their path set is empty.
- **Open:** subscriptions and global events, error boundaries and the document head. Each lost its API in the 2026-11-21 revision. See Open questions.

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

- **Subscriptions and global events.** A timer, a socket or a `keydown` listener lives across messages. One option without an API: a handler calls a runtime function such as `Time.every(1000, tick)` or `Browser.on('keydown', onKey)`, which starts the subscription and returns a plain handle. The handle is kept in an explicit union in state and passed to `stop(handle)` in another handler. On resume, the runtime restarts every handle in the state script. A subscription that runs from the first render would be a `let` whose initial value is such a call. Not decided.
- **Error boundaries.** The `catch` property is gone. The markup DSL can have a `#try` block, as brumate does. For the TSX proof of concept, the options are a convention, such as an exported `fallback` component in the same file, or no boundaries until the DSL. Not decided. Chunk load failures retry once and then fire `idlip:error` in either case.
- **Document head.** The `head` property is gone. A root component can render the whole document, `<html>` with `<head>` and `<title>{...}</title>`, and its holes patch like any other. A nested component's head, brumate's `#head` block, waits for the DSL. Not decided.
- **Purity of handlers.** See [0002](0002-modules.md).
- **Transitions.** Enter and exit animations for condition blocks and list items. Later.
- **Custom elements.** Hosting widgets as custom elements, with rules for attributes and properties. A ref and an awaited setup function cover the same need for now.
