# 0002: Modules and function components

Status: accepted

This proposal changes how an idlip module is written. It replaces the Messages, Update and Nesting sections of [0001](0001-dsl.md) and adds function components as a later layer. The rest of 0001 still holds.

## Decisions

- **One default export per module.** `defineModule` holds `init`, `update`, `view` and `subscriptions` in one object.
- **Handlers are the message spec.** Each tag and payload type is written once, as an `update` key and its payload parameter. `defineMessages` is removed.
- **The view receives `msg` as a parameter.** There is no `msg` export.
- **Stateless components are partials.** A partial is a plain function that returns JSX, and the compiler inlines it.
- **Nesting routes by model path.** A child's slice of the model is also its message prefix.
- **Messages pass down as props.** A child sends a message to its parent by dispatching a message the parent passed in as a prop.
- **File suffix `.idlip.tsx`.** It settles the file convention question in `docs/roadmaps/core/GOAL.md`.
- **Hole paths can be `dynamic`.** The view IR reserves this case. Until the `dynamic-paths` node lands, the analysis reports a hole whose paths it cannot resolve as a compile error.
- **Function components come after 0.1.** They compile to the `defineModule` form, which stays public.

## Module

```tsx
// todo.idlip.tsx
import { defineModule, event, For, Time } from 'idlip';

interface Todo {
  id: string;
  text: string;
  done: boolean;
}
interface Model {
  draft: string;
  todos: Todo[];
  timerOn: boolean;
}

export default defineModule<Model>()({
  init: () => ({ draft: '', todos: [], timerOn: false }),

  update: {
    add(m) {
      const todo = { id: createId(), text: m.draft, done: false };
      return { ...m, draft: '', todos: [...m.todos, todo] };
    },
    setDraft(m, text: string) {
      return { ...m, draft: text };
    },
    toggle(m, id: string) {
      return { ...m, todos: m.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) };
    },
    tick(m) {
      return m;
    },
  },

  view(m, msg) {
    return (
      <main>
        <input value={m.draft} on:input={msg.setDraft(event.value)} />
        <button on:click={msg.add()} disabled={m.draft === ''}>
          Add
        </button>
        <For each={m.todos} key="id">
          {(t) => (
            <li class={{ done: t.done }}>
              <input type="checkbox" checked={t.done} on:click={msg.toggle(t.id)} />
              {t.text}
            </li>
          )}
        </For>
      </main>
    );
  },

  subscriptions(m, msg) {
    return [m.timerOn && Time.every(1000, msg.tick())];
  },
});
```

Rules:

- `update` must come before `view` and `subscriptions`. TypeScript infers object properties in order, so a `view` placed first gets an untyped `msg`. The compiler reports the wrong order as an error.
- Each `update` key is a split point. The compiler emits one chunk per handler.
- The compiler finds message constructors as calls on the second parameter of `view` and `subscriptions`. It rewrites `msg.toggle(t.id)` in an event prop into DOM data.
- Other code gets the types with `ModelOf<typeof Todo>` and `MsgOf<typeof Todo>`. Tests call handlers as `Todo.update.add(model)`.

Checked with `tsc` 7 in strict mode. `msg` in `view` is inferred from the handlers. A wrong payload type and an unknown tag are both errors.

## Messages

A constructor is a function with a `tag` property. `msg.toggle('a1')` returns `{ t: 'toggle', p: 'a1' }`, and `msg.toggle.tag` is `'toggle'`. A handler with no payload parameter makes a constructor with no argument.

## Commands and subscriptions

- `subscriptions(m, msg)` passes messages built with `msg`, so their payloads are type-checked.
- A command inside a handler names the tag that receives its result as a string: `Http.get('/todos', 'gotTodos')`. Handlers cannot receive a typed `msg`, because the type of `msg` depends on the handlers themselves. A `tsc` test of that design failed with `Property 'gotTodos' does not exist on type 'Msgs<unknown>'`. The compiler reports a tag that is not an `update` key. Whether the payload type can also be checked is an open question for `core-api`.

## Event placeholder

`event` is imported from `idlip`. `event.value`, `event.checked` and `event.key` have DOM types, and the compiler writes them as `["$event","value"]`. This replaces the global `$event` from 0001.

## Partials

A partial is a function that takes model slices and returns JSX. The compiler inlines it into the caller's view, so path analysis reads through it. A partial has no chunk of its own. Partials can be named exports.

```tsx
export function TodoItem(props: { todo: Todo; onToggle: Message }) {
  return (
    <li class={{ done: props.todo.done }} on:click={props.onToggle}>
      {props.todo.text}
    </li>
  );
}
```

## Nesting

A parent lists which model fields hold child modules. Routing comes from that table.

```tsx
import Counter from './counter.idlip';

export default defineModule<Model>()({
  init: () => ({ left: Counter.init(), right: Counter.init(), counters: [] }),
  update: {
    ...children({ left: Counter, right: Counter, counters: list(Counter, 'id') }),
    removeCounter(m, id: string) {
      return { ...m, counters: m.counters.filter((c) => c.id !== id) };
    },
  },
  view(m, msg) {
    return (
      <main>
        <Counter.View model={m.left} />
        <For each={m.counters} key="id">
          {(c) => <Counter.View model={c} onRemove={msg.removeCounter(c.id)} />}
        </For>
      </main>
    );
  },
});
```

- A child's messages carry the model path of the child. `left` gives `left`, and the list item with key `c7` gives `counters`, `c7`. `compiled-format` fixes the DOM encoding. It must keep the path separate from the tag.
- A message prop such as `onRemove` is data. The child puts it in an event prop, or returns it from a handler with `cmd.send(message)`. It is dispatched with the parent's path.
- 0001's `as` prop, `nest()` and mapping functions are removed.

## Path tracking

Each view hole reads a set of model paths.

- **Static.** The analysis resolves the paths of the hole from the source. The manifest stores them. This covers the todo view, including helper calls such as `visible(m.todos, m.filter)` that take model paths as arguments.
- **Dynamic.** When the analysis cannot resolve the paths (aliases, a helper that takes the whole model), the hole is marked `dynamic`. The server evaluates the hole with a model proxy that records reads, and writes the recorded paths into the state script. After each patch, the client evaluates the hole again with the proxy and stores the new paths.

The `todo-resumes` milestone ships static paths only, and a `dynamic` hole is a compile error. The `dynamic-paths` node replaces that error with the runtime fallback.

## Function components

This section is for the milestone after 0.1. A function component compiles to the `defineModule` form. Its body is never called at runtime.

```tsx
// counter.idlip.tsx
import { state, every } from 'idlip';

export default function Counter(props: { start: number; step: number }) {
  let count = state(props.start);
  let auto = state(false);

  const parity = count % 2 === 0 ? 'even' : 'odd';

  function increment() {
    count += props.step;
  }
  function reset() {
    count = props.start;
  }
  function toggleAuto() {
    auto = !auto;
  }

  every(1000, increment, { when: auto });

  return (
    <section>
      <output>{count}</output>
      <button on:click={increment}>+</button>
      <small>{parity}</small>
      <button on:click={reset}>Reset</button>
      <input type="checkbox" checked={auto} on:change={toggleAuto} />
    </section>
  );
}
```

| Source                                                  | Compiles to                                                                                              |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `let x = state(v)`                                      | Model field `x`. `init` returns `{ x: v }`.                                                              |
| `const d = expr`                                        | `expr` over the model, inlined into the view and into each handler that reads `d`.                       |
| `function h(arg)`                                       | Handler `update.h`. Reads of state become model reads. Assignments build the next model.                 |
| Free variables of a handler that are not state          | Payload fields, evaluated at render time. `props.step` above gives the event `["increment",{"step":1}]`. |
| `every(...)` and other subscription calls               | `subscriptions`.                                                                                         |
| `return <jsx>`                                          | `view`.                                                                                                  |
| `<Counter start={0} step={1} />` in a parent            | A child slot in the parent model, named by position (`c0`, `c1`) or by an explicit `key`.                |
| A callback prop such as `onRemove={() => remove(t.id)}` | A message prop, as in Nesting.                                                                           |

Rules:

- **The body is a list of declarations.** Allowed are `state` declarations, pure `const` declarations, function declarations, subscription calls and one `return`. Any other statement is a compile error.
- **Handler free variables** must be state, derived values, module imports, or values that serialize (props, loop variables, `event` fields). Anything else is a compile error.
- **Derived values must be pure.** They are copied into several chunks.
- **Handlers are named functions.** The message log then shows `increment`, not a generated name.
- **No `await` in handlers** in the first version. Commands name a result handler instead.

What stays from MVU after compilation:

- All component state is one serializable model value.
- Every state change is a named message.
- `update` is a pure function of the model and the message, and tests can call it.

## Open questions

- Payload type checking for commands inside handlers.
- Positional slot names (`c0`) break when the JSX is reordered between deploys while old HTML is cached. Decide whether `key` is required on stateful children.
- Props copied into event payloads grow the HTML. Decide whether large props warn.
- Inline arrow handlers in function components, which would need generated tags.
- `await` in handlers, compiled into a command and a continuation handler.

## Prior art

- brumate compiles `$signal` components with closure captures into resumable chunks. idlip differs by keeping one model value, named messages and path diffs instead of a reactive graph.
- Svelte 5 runes and Marko 6 compile component bodies away.
