---
title: Effects
order: 30
section: Guide
description: An effect is an await in a handler. The compiler splits the handler there and runs the call as a task in the browser.
---

An effect is an `await` in a handler. The handler awaits an imported or module-level async function. The compiler splits the handler at the `await`. The part before it is one message, and the call runs as a task in the browser. The part after it is a second message, the continuation, which gets the result.

idlip has no `Http` or `Storage` commands and no `Result` type. Call `fetch`, `localStorage` or a library from your own async function and await it.

## A request with a loading state

The async function lives in a plain module:

```ts
// api.ts
export interface User {
  id: string;
  name: string;
}

export async function loadUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as User;
}
```

The component keeps the lifecycle in one union and sets it in the handler. The sample below has no server to fetch from, so a module-level `loadUser` that waits and returns a user stands in for the one in `api.ts`:

```tsx live
import type { JSX } from 'idlip/jsx-runtime';

interface User {
  id: string;
  name: string;
}

async function loadUser(id: string): Promise<User> {
  await new Promise((resolve) => setTimeout(resolve, 800));
  return { id, name: 'Ada' };
}

type UserState =
  | { state: 'idle' }
  | { state: 'loading'; id: string }
  | { state: 'failed'; error: string }
  | { state: 'loaded'; user: User };

export default function Profile(): JSX.Element {
  let user = { state: 'idle' } satisfies UserState as UserState;

  async function open(id: string) {
    user = { state: 'loading', id };
    try {
      user = { state: 'loaded', user: await loadUser(id) };
    } catch (error) {
      user = { state: 'failed', error: String(error) };
    }
  }

  return (
    <main>
      <button on:click={() => open('u1')}>Open</button>
      <p>{user.state}</p>
    </main>
  );
}
```

A click on Open runs these steps:

1. The message `open` with `['u1']` sets `user` to the loading state. The page patches at once, so the loading state shows.
2. The loader loads the `task=open$1` chunk and calls `loadUser('u1')` in it. That chunk holds only `loadUser`, or only its import when it comes from another module.
3. When the call settles, the loader queues the continuation `open$1` with the outcome: `{ ok: true, value }` or `{ ok: false, error }`.
4. `open$1` runs the rest of the `try` block, or the `catch` block on a failure, and the page patches again.

`tsc` checks the call and its result as ordinary TypeScript. The test `packages/idlip/test/client/tasks/tasks.test.ts` covers these steps, and `packages/idlip/test/fixtures/effects/` has the compiled chunks of a larger example.

## Built-in values

`Random` and `Time` from `idlip` give the values a handler must not compute itself, because a handler is pure. Await them like any task:

```tsx live
import { Random, Time } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

interface Note {
  id: string;
  at: number;
}

export default function Notes(): JSX.Element {
  let notes = [] satisfies Note[] as Note[];

  async function add() {
    const id = await Random.id();
    const at = await Time.now();
    notes = [...notes, { id, at }];
  }

  return (
    <main>
      <button on:click={add}>Add</button>
      <p>{notes.length}</p>
    </main>
  );
}
```

| Call               | Value                                                       |
| ------------------ | ----------------------------------------------------------- |
| `Random.id()`      | `crypto.randomUUID()`                                       |
| `Random.number()`  | `Math.random()`                                             |
| `Time.now()`       | `Date.now()`                                                |
| `Time.sleep(ms)`   | Resolves after `ms` milliseconds.                           |
| `Dom.measure(ref)` | The box of an element, see [Refs](./refs.md#the-dom-calls). |

These calls are built in: their code sits in the handler chunk, and no task chunk loads. Their continuation runs in the same batch as the message. A handler that awaits only built-ins patches the page once, at the end. A handler that awaits `Time.sleep(500)` shows nothing new for 500 ms. To wait in the background, use a [subscription](./subscriptions.md) instead.

A call is built in only when its root name is imported from `idlip`.

## State after an await

- Each continuation reads the model again. A read after the `await` sees the model at that moment, with the writes of any message that ran in between.
- A `const` or `let` local declared before the `await` is carried to the continuation as part of its payload. Props that a later part reads are carried the same way.
- An `await` in the middle of an expression is lifted. In `todos = [...todos, await makeId()]`, the read of `todos` happens after the call settles, so a write made in between is kept.
- Each click starts its own task. Two clicks on Open run two calls, and the continuations run in the order the calls settle.

## Errors

A rejection inside a `try` runs the `catch` block. A rejection outside a `try` is thrown at the start of the continuation. The loader reports it in the console, and the model stays as the part before the `await` left it.

A task chunk that fails to load is reported the same way, and no continuation runs.

## Server, resume and unmount

- **Server.** Handlers never run on the server, so no task runs there. The server renders the model the component starts with.
- **Resume.** A handler chunk imports nothing that only an awaited call uses. The task chunk loads when a handler reaches its `await`, not before.
- **Serialized.** A task runs in the browser and its arguments and result stay there. The continuation is an ordinary message whose payload is `[outcome, ...carried locals, ...props]`, all plain data.
- **Unmount.** A running task is not cancelled. When the component is a child that has left the page by the time the task settles, its continuation is dropped.

## Common errors

| Rule id           | Cause                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| `await-callee`    | The awaited value is not a call to an import or a module-level function, such as `await fetch(url)`. |
| `await-placement` | An `await` inside an `if` or a loop.                                                                 |
| `await-nested`    | An `await` inside a nested `try`, or inside a `catch` or `finally` block.                            |
| `await-multiple`  | Two `await`s in one statement. Put each in a statement of its own.                                   |
| `await-finally`   | An `await` in a `try` that has a `finally` block.                                                    |
| `await-handler`   | A handler calls another handler that awaits, or a handler that awaits calls itself.                  |

Move the `await` to the top level of the handler or of a `try` block. To branch, set a local before the `await` and test it after.
