# Concurrency model: what is settled

Settled with the user in discussion, 2026-11-23. The debate in this node starts from here and only takes up the open questions at the end. Reopen a settled point only with new evidence.

## A promise is a value in the model

- A model field can hold a promise. Its type says so: `let source: Promise<Item[]> = props.items`. There is no union with the value type, and no cast.
- A promise reaches the model in one of two ways:
  - **At the edge**, as a prop. The render functions accept the promise as given.
  - **In a handler**, by assignment: `source = loadItems()`. Assigning a promise stores it. Nothing waits and nothing suspends at the assignment.
- The model stays serializable. seroval writes a pending promise into the state script and streams its resolution later, on the `pending` stream that `render-stream` left for this. The loader revives it as a real `Promise`. This is plumbing, not an open problem:
  - A promise that never settles keeps the response open, so it needs a timeout.
  - A promise assigned in the browser is never serialized.
  - The message log records the settled value, so replay works.

## Suspending is triggered by reading, through an async component

- A component that reads a promise is an `async function`, and it unwraps the promise with `await`: `const items = await props.items`. After the `await`, `items` has the value's type, so every computation on it (`items.length`, `.filter`) type-checks.
- **An async component suspends as a whole while anything it awaits is pending.** Its output shows once all its awaits have settled. This keeps the JavaScript meaning of `await`: everything after it, including the returned JSX, waits.
- So a boundary inside an async component cannot catch that component's own `await`. **The boundary goes in the parent, around the async component.** This is the React model.
- `await` in a component body may only unwrap a prop, a model field or a derived value. `await fetch(...)` or `await loadItems()` in a component body is a compile error, because a request belongs in a handler or at the edge, not in the view.
- A finer loading UI means smaller async components. A stateless async component is inlined, so splitting adds no loader cost. Only a stateful child turns on child-component code, which `entry-setup` measured at +857 B.

```tsx
// item-list.tsx: stateless and async, only unwraps what it is given
export async function ItemList(props: { items: Promise<Item[]> }): Promise<JSX.Element> {
  const items = await props.items;
  return (
    <>
      <p>{items.length} items</p>
      <For each={items} key={(i) => i.id}>
        {(i) => <li>{i.name}</li>}
      </For>
    </>
  );
}

// page.tsx: owns the state and the loading UI
export default function Page(props: { items: Promise<Item[]> }): JSX.Element {
  let source = props.items;

  function reload() {
    source = loadItems();
  }

  return (
    <main>
      <button on:click={reload}>Reload</button>
      <Loading fallback={<p>Loading…</p>}>
        <ItemList items={source} />
      </Loading>
    </main>
  );
}
```

## The boundary

- `<Loading fallback={…}>` is a block component, like `<Try>` and `<For>`. It shows its fallback while an async component inside it is suspended.
- With no boundary, the server waits for the value before the first flush, and the browser keeps showing what it had.
- **Refresh**, meaning a pending value replaces one that already showed:
  - An attribute on `<Loading>` chooses what the boundary shows: the stale content, or the fallback again. The first load always shows the fallback, since there is nothing stale to show.
  - `isPending(value)` tells the view that a refresh is running, for a spinner or for dimming the stale content. It is a runtime function, not a compile-time marker: the model holds the real promise, and the runtime knows whether it has settled. A hole that calls it updates when the promise settles.

## Overlap: latest wins, as plain assignment

- A field holds the last value assigned to it. When a newer promise replaces an older one, the older one settling changes nothing, because nothing reads it any more. There is no race manager, and no request id in the model. This is ordinary assignment.
- Policies other than latest wins (merging pages, first answer wins, combining sources) are written by the user in an async handler that `await`s and decides what to assign. Elm's `update` does the same. This exists today (`custom-effects`).
- **Cancelling is opt-in and visible in user code.** idlip never aborts a request on its own.

## Errors

A rejected promise suspends nothing. The async component that awaited it throws, and the nearest `<Try>` above it renders its catch view. `reset()` assigns a new value, so a retry is just another assignment.

## Open, for the debate

1. **Names and the refresh attribute.** `<Loading>` or another name; the attribute's name and values (for example `refresh="stale" | "fallback"`); which one is the default. Stale is the leading candidate, as in React transitions and Solid 2.
2. **The `isPending` API.** Its name, its signature, and whether it reads the promise field or the async component.
3. **Cancelling.** How a handler gets an `AbortSignal` that fires when the field it assigns is replaced, without a compile-time API. Or whether cancelling stays entirely the user's job, through their own `AbortController`.
4. **Handlers that read a pending field.** A handler that reads `source` gets the promise, since that is the field's type. Decide whether any rule is needed beyond that.
5. **The dev warning.** Warn when an async component with no `<Loading>` above it makes the whole page wait on the server.
6. **The inlining check.** Confirm that a stateless async component inlines with no loader cost, and that a stateful async component works as a child.
7. **The loader cost.** Measure suspending and streaming behind a `HAS_*` flag. `loader-savings` must land first.

Prior art for the debate: Elm (Task, Cmd, RemoteData, `Http.cancel` with a tracker), Hyperapp v2 effects, React (`use`, Suspense, transitions), Solid 2 (async memos, `<Loading>`, `isPending`), brumate (`$memo` over a promise, `#loading`, `$isPending`), Marko 6 (`<await>`), Qwik (`useResource$`).
