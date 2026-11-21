---
title: Errors
order: 23
section: Guide
description: Catch a throwing hole with Try, retry with reset, and listen for idlip:error to report handler and chunk failures.
---

Three things can fail on a page: a hole that throws while it renders, a handler that throws, and a chunk that does not load. A `<Try>` handles the first. All three fire the `idlip:error` event on `document`.

## Catch a hole with Try

`<Try>` shows its `catch` view when a hole inside it throws, on the server or in a patch. The rest of the page keeps working:

```tsx
import { Try } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

function parse(text: string): number {
  const value = Number(text);
  if (Number.isNaN(value)) {
    throw new Error(`not a number: ${text}`);
  }
  return value;
}

export default function Price(): JSX.Element {
  let text = '10';
  let clicks = 0;

  function setText(next: string) {
    text = next;
  }
  function click() {
    clicks = clicks + 1;
  }

  return (
    <main>
      <input value={text} on:input={(e) => setText(e.currentTarget.value)} />
      <Try
        catch={(error, reset) => (
          <p>
            {error} <button on:click={reset}>Retry</button>
          </p>
        )}
      >
        <output>{parse(text) * 2}</output>
      </Try>
      <button on:click={click}>Clicked {clicks}</button>
    </main>
  );
}
```

- **`error`** is a string: `name: message` for an `Error`, such as `Error: not a number: ab`, else the thrown value as text.
- **`reset`** is a message target. `on:click={reset}` renders the body again from the current model. If the body still throws, the catch view shows the new error.
- **The catch view is not patched.** Its holes show the values of the moment it rendered. Fix the input, then press Retry.
- **In a `<For>` row**, each row has its own region. A throwing row swaps to its catch view and the other rows stay.

A catch view holds elements, text, holes and conditions. A `<For>`, a child component, a `<Subscribe>` or another `<Try>` in it is the error `try-catch-node`. `catch` is an arrow with an expression body (`try-catch`).

A hole that throws outside any `<Try>` stops the patch, so holes it did not reach keep their old values. The new model is kept, the error goes to the console and to `idlip:error`, and the next message patches from the last good render.

## Handlers that throw

A handler that throws changes nothing: the model stays as it was before the message, and the page is not patched. The loader logs the error and fires `idlip:error`. Later messages run as usual.

## Chunks that do not load

When a handler or binding chunk fails to load, for example on a flaky network:

- **The event stays in the queue**, and later events of the same page wait behind it, so messages keep their order. The next event with the same handler loads the chunk again.
- **In an app with a `<Try>`, the loader asks once more at once** under another URL, since a browser may keep a failed import.
- **`idlip:error` fires** when the load fails for good.
- **After a deploy**, a missing chunk can mean the page comes from an older build. The loader then reloads the page once. See [Deploying](./deploying.md#cached-pages-after-a-deploy).

## Listen for idlip:error

The event is a `CustomEvent` on `document`. `detail.error` is the thrown value and `detail.path` is the model path of the component that failed, an empty string for the root:

```ts
document.addEventListener('idlip:error', (event) => {
  const { error, path } = (event as CustomEvent<{ error: unknown; path: string }>).detail;
  navigator.sendBeacon('/errors', JSON.stringify({ message: String(error), path }));
});
```

Add the listener in a module script of the host page. It fires for a region that caught an error, a handler that threw, a patch that failed and a chunk that failed to load.

## In tests

`settled()` of `idlip/testing` rejects with the first error since the last step. That includes an error a `<Try>` caught, so a test does not pass over a catch view by mistake. Pass `expectCaught: true` to `mount` in a test that expects the catch view. See [Testing](./testing.md#errors).
