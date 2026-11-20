# 0004: Custom effects, refs, error boundaries and other gaps

Status: draft

This proposal fills gaps found by a feature review of the core roadmap on 2026-11-20. It builds on [0002](0002-modules.md) and does not change how a module is written, apart from the new optional `catch` and `head` properties.

## Decisions

- **Custom effects.** `task()` and `defineSub()` wrap module-level functions. A command or subscription refers to them by id, so it stays plain data. One mechanism covers promises, server calls, sockets, timers and third-party libraries.
- **Refs.** A `ref` attribute names an element. Commands, tasks and subscriptions take the ref, and the runtime resolves it to the element when they run.
- **Error boundaries per module.** A module can declare `catch`, a fallback view. Each module is a boundary. There is no boundary component.
- **Global events** are subscriptions: `Browser.on('keydown', msg.key)`.
- **Document head** comes from the root module's `head(m)`.
- **SVG and MathML** keep their namespace in templates and item templates.
- **Raw HTML** goes through `html={trusted(value)}`. A plain string is a type error.
- **Imported and module-level constants** are allowed in holes. Their path set is empty.

## Custom effects

### Tasks

A task wraps an async function declared at module level. The compiler gives it a stable id and its own chunk, like an update handler. The function never enters the model or the DOM.

```ts
// user.ts
import { task } from 'idlip';

export const loadUser = task(async (id: string, signal: AbortSignal) => {
  const res = await fetch(`/api/users/${id}`, { signal });
  return (await res.json()) as User;
});
```

A handler returns the command that runs it. The command is data: `{ kind: 'task', args: { id, input }, to, err }`.

```ts
update: {
  open(m, id: string) {
    return [{ ...m, loading: true }, loadUser.run(id, 'gotUser', 'loadFailed')];
  },
  gotUser(m, user: User) {
    return { ...m, loading: false, user };
  },
  loadFailed(m, error: string) {
    return { ...m, loading: false, error };
  },
}
```

- `task()` must be called at module level. The compiler rejects a call inside a function.
- The result goes to the `to` tag and a rejection to the `err` tag. A rejection with no `err` tag fires `idlip:error`.
- Concurrency: `task(fn, { mode })` with `mode` one of `'all'` (default), `'latest'` (aborts the previous run of the same task) or `'queue'`. `Task.cancel(loadUser)` aborts running instances through the `AbortSignal`.
- `Time.after(ms, tag)` is a built-in task. A debounce is a `'latest'` task that waits first.
- The built-in `Http` and `Storage` commands are tasks inside the runtime, so there is one executor path.
- Tasks run only on the client. `init` returns a model and no command, so the server never runs a task. Data loading on the server stays a non-goal.

### Subscriptions

A custom subscription wraps start, update and stop functions.

```ts
import { defineSub } from 'idlip';

export const socket = defineSub({
  start(url: string, send: (data: string) => void) {
    const ws = new WebSocket(url);
    ws.onmessage = (e) => send(e.data);
    return ws;
  },
  stop(ws) {
    ws.close();
  },
});

subscriptions(m, msg) {
  return [m.online && socket.listen(m.url, msg.received)];
}
```

- `listen(args, constructor)` returns a `Sub`. It takes a message constructor, not a message, because the value it sends becomes the payload.
- The runtime compares active subscriptions by id and args. New ones start, missing ones stop. When only the args change and the subscription has `update(state, args)`, the runtime calls it instead of restarting. A widget then gets new data without being mounted again.

## Refs

```tsx
<input ref="search" value={m.query} on:input={msg.setQuery(event.value)} />
<For each={m.rows} key="id">
  {(row) => <tr ref={['row', row.id]}>...</tr>}
</For>
```

- A ref name is a string literal, or a tuple of a literal and a loop variable path inside `<For>`. It is local to the module instance.
- `ref('search')` builds a ref value for commands: `Dom.focus(ref('search'))`, `Dom.scrollIntoView(ref(['row', id]))`, `Dom.measure(ref('chart'), 'measured')`. `Dom.measure` sends the element's bounding box as the payload.
- A task or subscription input may hold refs. The runtime resolves each to its `Element` before calling the function, so a chart library can mount on `ref('chart')` from a custom subscription.
- `Dom.focus` from [0003](0003-update-analysis.md) takes a ref instead of a selector.

## Error boundaries

```tsx
export default defineModule<Model>()({
  init, update,
  view(m, msg) { ... },
  catch(error) {
    return <p class="error">This panel failed to load.</p>;
  },
});
```

- On the server, when a hole, helper or child module throws while rendering, the nearest module with `catch` renders its fallback in place. A module without `catch` passes the error to its parent. At the root, the render fails as it does today.
- On the client, when a binding chunk throws while patching, the runtime replaces the nearest boundary's region with its fallback, loaded as its own chunk. The model is kept, and `idlip:error` fires with the module path.
- When a chunk fails to load, the runtime retries once. If it fails again, the runtime fires `idlip:error`, which `deploy-skew` can handle. A handler that throws keeps the model, as before.
- `catch(error)` takes no model and no `msg`, so the fallback cannot depend on the state that failed. It is static markup.

## Global events

`Browser.on(name, constructor, options)` is a built-in subscription for `window` and `document` events: `keydown`, `resize`, `popstate`, `online`, `visibilitychange`. The payload uses the same placeholders as `event` (`event.key`), resolved when the event fires. Options take the key filters from `compiled-format`.

## Document head

The root module may declare `head(m)`, which returns `{ title, meta }`. Its holes follow the closed grammar. The server writes them into `<head>`, and they patch like bindings. A nested module's `head` is a compile error.

## SVG, MathML and raw HTML

- Elements inside `<svg>` and `<math>` keep their namespace. A `<For>` or condition block inside them gets a template parsed in that context, so rows created on the client use the right namespace.
- `html={trusted(value)}` sets the element's content from a string. `trusted()` returns a branded `TrustedHtml`, so a plain string is a type error. The element must have no children. The server writes the string as is, and the patcher sets `innerHTML`.

## Constants in holes

A hole may read imported values and module-level `const` bindings, such as `class={styles.item}` from a CSS module or an icon map. Their path set is empty, so they render once on the server and never patch.

## Open questions

- **Purity of update handlers.** The examples call `createId()` inside a handler. Either allow impure handlers, or make randomness and time commands (`Random.id('added')`, `Time.now('gotTime')`). This affects devtools replay and deterministic tests. Not decided.
- **File payloads.** `File` objects do not serialize, so they cannot enter the model. One option is that an `event.files` placeholder may only be passed to a task, not stored. Not decided.
- **Transitions.** Enter and exit animations for condition blocks and list items. Later.
- **Custom elements.** Hosting widgets as custom elements, with rules for attributes and properties. Custom subscriptions with refs cover the same need for now.
