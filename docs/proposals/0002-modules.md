# 0002: Components

Status: accepted. Revised 2026-11-21: function components are the only way to write a module. `defineModule`, `state()`, `task()` and the other compile-time APIs are removed. This replaces the 2026-11-20 revision (a declared `Msg` interface and `defineModule<Model, Msg>()`), which replaced the first version.

This proposal replaces the Messages, Update and Nesting sections of [0001](0001-dsl.md). The rest of 0001 still holds.

## Decisions

- **A module is a function component.** A `*.idlip.tsx` file exports components as function declarations. The compiler reads the body and emits the view IR, the server render function and one chunk per handler. The body never runs.
- **No compile-time APIs.** Nothing is imported from `idlip` only so that the compiler can find it. The syntax carries the meaning: `let` is state, `const` is a derived value, a function declaration is a handler, and `return` is the view. A marker for state would need a marker for derived values too, and would leave unmarked `let` and `const` with unclear meaning. `<For>` is the one exception until the markup DSL (`markup-frontend`) replaces it with a block.
- **A handler is a message.** Each function declared in the body is a message tag and a chunk. There is no `Msg` interface: `tsc` checks each call to a handler against its parameters.
- **Effects are `await` in a handler.** The compiler splits an async handler at each `await` into a task and a continuation. This replaces `task()`, `Result<T>` and commands that take constructors. Errors go to `try` and `catch`.
- **Components nest as JSX.** `<Counter start={0} />` gives the child a slot in the parent's model. A component with no state and no handlers is inlined, as partials were.
- **MVU stays after compilation.** All state is one serializable model value, every change is a named message, and the compiled update functions are pure functions of the model and the message.
- **File suffix `.idlip.tsx`.** Unchanged.

## Example

```tsx
// todo.idlip.tsx
import { For } from 'idlip';
import { saveTodos } from './api';

interface Todo {
  id: string;
  text: string;
  done: boolean;
}
type Save = { state: 'idle' } | { state: 'saving' } | { state: 'failed'; error: string };

function countLeft(todos: readonly Todo[]): number {
  let left = 0;
  for (const todo of todos) {
    if (!todo.done) left++;
  }
  return left;
}

export default function TodoApp(props: { initial: Todo[] }) {
  let draft = '';
  let todos = props.initial;
  let save = { state: 'idle' } satisfies Save as Save;

  const left = countLeft(todos);

  function setDraft(text: string) {
    draft = text;
  }
  function add() {
    if (draft === '') return;
    todos = [...todos, { id: crypto.randomUUID(), text: draft, done: false }];
    draft = '';
  }
  function toggle(id: string) {
    todos = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  }
  async function persist() {
    save = { state: 'saving' };
    try {
      await saveTodos(todos);
      save = { state: 'idle' };
    } catch (error) {
      save = { state: 'failed', error: String(error) };
    }
  }

  return (
    <main>
      <input value={draft} on:input={(e) => setDraft(e.currentTarget.value)} />
      <button on:click={add} disabled={draft === ''}>
        Add
      </button>
      <button on:click={persist} disabled={save.state === 'saving'}>
        Save
      </button>
      <p>{left} left</p>
      <For each={todos} key="id">
        {(t) => (
          <li class={{ done: t.done }}>
            <input type="checkbox" checked={t.done} on:click={() => toggle(t.id)} />
            {t.text}
          </li>
        )}
      </For>
    </main>
  );
}
```

Checked with `tsc` 7.0.2 in strict mode on 2026-11-21: `toggle(1)` in an event is a type error, `e.currentTarget` has the element's type, `key` must be a field of the item, a missing prop on `<TodoApp />` is a type error, and a wrong initial value in `satisfies Save as Save` is a type error.

## What compiles to what

| Source                                             | Compiles to                                                                                                      |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `let x = v`                                        | Model field `x`, with initial value `v`.                                                                         |
| `const d = expr`                                   | `expr` over the model, inlined into the view and into each handler that reads `d`.                               |
| `function h(a, b)`                                 | Message tag `h` with payload `[a, b]`, and an update chunk. Reads of state are model reads. Assignments build the next model. |
| `async function h()` with `await f(x)`             | The part before the `await` is message `h`. `f(x)` runs as a task on the client. The rest is a continuation message. |
| `on:click={h}`                                     | Message `h` with no arguments.                                                                                   |
| `on:click={() => toggle(t.id)}`                    | Message `toggle` with payload `[t.id]`, computed at render.                                                      |
| `on:input={(e) => setDraft(e.currentTarget.value)}` | Message `setDraft` whose payload is read from the event when it fires.                                           |
| A handler's free variables that are props           | Payload fields computed at render.                                                                               |
| `return <jsx>`                                     | The view.                                                                                                        |
| `<Counter start={0} />` in a parent                | A child slot in the parent model.                                                                                |
| `onRemove={() => remove(c.id)}` on a child         | A message prop, dispatched with the parent's path.                                                               |

## Rules

Each rule is a compile error with a rule id unless it says otherwise.

- **The body is a list of declarations:** `let` and `const` declarations, function declarations and one `return`. Any other statement is an error.
- **`let` is state.** Its type comes from its initial value. A wider type, such as a union for a lifecycle, is written `let x = v satisfies T as T`. `let x: T = v` and a bare `v as T` are errors. Why: the view sits in the function that declares the state, and TypeScript narrows an annotated `let` to its initial value there, so `save.state === 'saving'` in the view would be the type error TS2367. A bare `as T` hides a wrong initial value; `satisfies T` catches it. A `let` that is never assigned is a warning.
- **`const` is a derived value.** Its expression is in the closed grammar of `contracts/view-ir.md`, so it is pure and can be copied into several chunks.
- **Initial values** are in the closed grammar over props, imports and module-level constants.
- **Handlers are function declarations,** so every message has a name in the log. A handler body is ordinary TypeScript and runs only on the client. It changes state only by assigning to state variables. Changing a state value in place (`todos.push(x)`) is an error in the first version. A handler may call another handler, and the call runs as part of the same message.
- **Event attributes** take a handler, or an arrow whose body is one call to a handler. The call's arguments are in the closed grammar over state, derived values, props, loop variables and property paths on the event parameter. Event paths are read when the event fires. Any other closure is an error.
- **Handler free variables** are state, derived values, props, other handlers, imports and module-level declarations. Anything else is an error.
- **`await`** may appear in top-level statements of a handler and inside `try` blocks. An `await` in a loop or a condition is an error in the first version. The awaited callee is an import or a module-level function. Locals that live across an `await` become payload fields of the continuation, so they must serialize. After an `await`, a read of state reads the model at that moment, as a closure would in plain TypeScript. Two clicks start two independent runs.
- **State serializes** with seroval. A function assigned to state is a compile error. Class instances other than Date, Map, Set and the web types seroval supports are rejected at server render, with the model path. `File` and `Blob` may be held in state on the client only: see [0004](0004-effects-refs-errors.md), Files.

## Messages

A message is `{ t, p }`: the handler's name and its arguments as an array. The message log shows `toggle("a1")`. A continuation after an `await` has the tag `persist$1` and the log shows it as the first continuation of `persist`. `compiled-format` fixes the DOM encoding.

## Props and nesting

- A component takes one parameter, `props`, or an object pattern of it.
- The root component's props come from the server: `render(TodoApp, { initial })`. They serialize into the state script.
- A child component used in a parent's JSX gets a slot in the parent's model, named by an explicit `key` or by position. Inside `<For>`, the slot is keyed by the loop key.
- A child's messages carry the model path of the child, kept separate from the tag.
- A callback prop such as `onRemove={() => remove(c.id)}` follows the event attribute rule and compiles to a message prop. The child calls `props.onRemove()` in a handler or passes it to an event attribute. It is dispatched with the parent's path.
- A component with no `let` and no handlers is inlined into its caller's view, so path analysis reads through it. It has no chunk of its own.

## Path tracking

Each view hole reads a set of model paths.

- **Static.** The analysis resolves the paths of the hole from the source. The manifest stores them. This covers the todo view, including helper calls such as `countLeft(todos)` that take state paths as arguments.
- **Dynamic.** When the analysis cannot resolve the paths (aliases, a helper that takes the whole model), the hole is marked `dynamic`. The server evaluates the hole with a model proxy that records reads, and writes the recorded paths into the state script. After each patch, the client evaluates the hole again with the proxy and stores the new paths.

The `todo-resumes` milestone ships static paths only, and a `dynamic` hole is a compile error. The `dynamic-paths` node replaces that error with the runtime fallback.

## Open questions

- **Subscriptions.** There is no `subscriptions` function. One option: a handler starts a subscription with a runtime call that returns a plain handle, keeps it in an explicit union in state, and stops it in another handler. The runtime restarts the handles in the state script on resume. See [0004](0004-effects-refs-errors.md).
- **Concurrency of async handlers.** Every run continues today. Whether a newer run can cancel an older one, and how that is written without an API, is open.
- **Purity of handlers.** The example calls `crypto.randomUUID()` in a handler. This affects devtools replay and deterministic tests.
- **Positional slot names** break when the JSX is reordered between deploys while old HTML is cached. Decide whether `key` is required on stateful children.
- **Large props** copied into event payloads grow the HTML. Decide whether they warn.

## Prior art

- brumate compiles `$signal` components with closure captures into resumable chunks. idlip differs by keeping one model value, named messages and path diffs instead of a reactive graph, and by using no markers.
- Svelte 4 used plain `let` for component state. Svelte 5 moved to `$state` so state can live outside components, which idlip does not allow.
- Marko 6 compiles component bodies away.
