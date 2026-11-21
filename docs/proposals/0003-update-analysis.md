# 0003: Write sets, update ops, form fields and keyed paths

Status: draft

This proposal adds four refinements to the MVU core of [0001](0001-dsl.md) and [0002](0002-modules.md). Its examples predate the 2026-11-21 revision of 0002 and use the `defineModule` form. The analyses apply to the compiled handlers of function components, where a write set comes from the assignments to state. The Form fields section is redesigned by the `form-fields` node. All four come from the same idea: the compiler already knows what each view hole reads, so it should also know what each handler writes.

## Decisions

- **Write sets.** The compiler finds the model paths each update handler writes. The client then loads the handler chunk and the binding chunks it can affect in parallel, not one after the other.
- **Update ops.** A handler that only sets, toggles, adds to or removes from model paths compiles to a list of ops. The client runtime applies the ops directly and loads no handler chunk.
- **Form fields.** `event.form.<name>` reads a form field when the message is dispatched. Input text that the view does not read stays in the DOM, not in the model.
- **Keyed paths.** A path segment can select a list item by key, such as `todos[id=$p].done`. Handlers that change one item patch one item, and lookups by key become static holes instead of `dynamic` ones.

## Why

The `todo-resumes` milestone loads one handler chunk and the binding chunks whose paths changed. Today the order is:

1. Load the handler chunk.
2. Run the handler and diff the old and new model along the binding paths.
3. Load the binding chunks whose paths changed.
4. Patch.

Steps 1 and 3 are two network round trips in sequence. For the todo `toggle` handler, both are known before the click. Common handlers such as `setDraft` and `toggle` are a single assignment, yet each costs a chunk request. Typing into a controlled input sends one message per keystroke.

## Write sets

The update analysis reads each handler and records the paths of the model it returns that can differ from the input model.

| Handler body                                                                              | Write set           |
| ----------------------------------------------------------------------------------------- | ------------------- |
| `return { ...m, draft: text }`                                                            | `draft`             |
| `return { ...m, draft: '', todos: [...m.todos, todo] }`                                   | `draft`, `todos`    |
| `return { ...m, todos: m.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) }` | `todos[id=$p].done` |
| `return m`                                                                                | none                |
| A call to a helper that takes `m`                                                         | unresolved          |

Rules:

- A write set is an upper bound. A handler may write fewer paths at runtime, for example when it returns `m` in one branch.
- An unresolved handler gets the write set `*`, which matches every binding. The client then uses the current order: run the handler, diff, load.
- The manifest maps each message tag to its chunk and its write set. The compiler also lists the binding groups whose read sets intersect the write set.

On an event, the client:

1. Starts loading the handler chunk and the listed binding chunks at the same time.
2. Runs the handler when its chunk arrives.
3. Diffs the old and new model, but only along the paths in the write set.
4. Patches the changed bindings once their chunks arrive.

A binding chunk loaded for a path that did not change at runtime goes unused. That costs bytes, not correctness.

The `prefetch` node uses the same data. For each message in the page, the manifest already lists every chunk the message can need.

## Update ops

A handler whose body matches one of the patterns below compiles to ops. The message tag stays in the DOM and in the message log. Only the manifest entry changes, from a chunk to an op list.

| Op                             | Source pattern                                               |
| ------------------------------ | ------------------------------------------------------------ |
| `["set", path, value]`         | `{ ...m, draft: text }`, `{ ...m, filter: 'done' }`          |
| `["toggle", path]`             | `{ ...m, open: !m.open }`                                    |
| `["add", path, number]`        | `{ ...m, count: m.count + 1 }`                               |
| `["push", path, value]`        | `{ ...m, items: [...m.items, item] }` when `item` is a value |
| `["remove", path, key, value]` | `m.todos.filter((t) => t.id !== id)`                         |

- A value is a literal, the payload (`["$p"]`), a field of the payload, or a read of another model path.
- A path can be a keyed path, so `toggle` in the todo example compiles to `["toggle", "todos[id=$p].done"]`.
- One handler can compile to several ops, applied in order. The ops build the next model with the same structural sharing as the spread code.
- A handler keeps its chunk when it returns a command or calls a function, including `createId()`. The same holds for any branch other than the keyed-item pattern.
- The write set of an op handler is exact.

Tests still call `Todo.update.toggle(model, 'a1')`, because the source handler stays in the module. For each op handler in the fixtures, the compiler test suite checks that the ops and the handler return the same model. It runs the check over generated models and payloads.

The op interpreter adds code to the client runtime. Its size must be measured by the `benchmarks` node before op handlers are enabled by default. Until then, a compiler option turns them on.

## Form fields

`event.form` gives the fields of the form that contains the event target. `event.form.draft` reads `new FormData(form).get('draft')` when the message is dispatched. The compiler writes it as `["$form","draft"]`.

```tsx
<form on:submit={msg.add(event.form.draft)}>
  <input name="draft" />
  <button>Add</button>
</form>
```

- A value belongs in the model only when the view or a handler other than the one receiving it reads it. In the example above, the view never reads the draft, so it stays in the input.
- `event.form.<name>` has the type `string`. Fields with several values use `event.form.all.<name>`, of type `string[]`.
- A handler cannot touch the DOM, so clearing or focusing a field is a command: `Dom.reset('#new-todo')` and `Dom.focus('#new-todo')`. They follow the commands of 0002 and load their executor lazily.
- The DOM keeps form field values across resume with no state script entry, because the server renders them as attributes.
- `submit` events from `on:submit` call `preventDefault()` by default.

If the view needs the value, for example `disabled={m.draft === ''}`, the field stays controlled and in the model, as today.

## Keyed paths

0001 and 0002 write list items as `*`, as in `todos.*.done`. A keyed path names the item instead:

| Path                      | Meaning                                                   |
| ------------------------- | --------------------------------------------------------- |
| `todos.*.done`            | `done` of every item. Used when the item is not known.    |
| `todos[id=$p].done`       | `done` of the item whose `id` equals the message payload. |
| `todos[id=$p.id].done`    | The same, with the key read from a payload field.         |
| `todos[id=selected].text` | `text` of the item whose `id` equals `m.selected`.        |

- The key field must be the `key` of the `<For>` that renders the list, or a field the analysis proves unique. Otherwise the path falls back to `*`.
- On the write side, a write to `todos[id=$p].done` makes the client compare one item, found by key, instead of every item.
- On the read side, `m.todos.find((t) => t.id === m.selected)` resolves to `todos[id=selected]`. Under 0002 that hole is `dynamic`. With keyed paths it is static, and its binding depends on both `selected` and the item.
- `*` stays valid and means "any item", so every existing path set keeps its meaning.

## Contract changes

All three contracts are still `draft`. The encodings below should be reserved now, so that adding the features later does not break cached HTML or golden fixtures.

- `compiled-format`:
  - Manifest entry for a message tag: `{ chunk, writes, bindings }` or `{ ops, writes, bindings }`.
  - Path syntax with keyed segments: `name[key=source]`, where `source` is `$p`, `$p.<field>` or a model path.
  - The `["$form", name]` placeholder.
- `view-ir`: hole path sets can contain keyed segments.
- `core-api`: `event.form`, and the `Dom.reset` and `Dom.focus` commands.

## Roadmap changes

These go in the `apps` milestone, after `example-todo`. The exceptions are the contract reservations, which land now, and `update-ops`, which moves to the `0.2` milestone.

| Change                                              | Node                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------- |
| Reserve manifest fields, keyed path syntax, `$form` | `compiled-format`, `core-api`, `spike-view-analysis` (now)          |
| Write set analysis and parallel loading             | new node `write-sets`, depends on `compile-update`, `resume-loader` |
| Keyed paths in view and update analysis             | new node `keyed-paths`, depends on `write-sets`, `patch-lists`      |
| Update ops and the op interpreter                   | new node `update-ops`, depends on `write-sets`, `benchmarks`        |
| `event.form` and `Dom` commands                     | new node `form-fields`, depends on `commands-subs`                  |
| Prefetch from the manifest write sets               | existing `prefetch` gains a soft dependency on `write-sets`         |

`dynamic-paths` should land after `keyed-paths`, since keyed paths remove part of its work.

## Open questions

- Whether the manifest ships in the HTML or as a chunk. The parallel load needs it before the first event.
- How many binding chunks a broad write set such as `todos` may pull in before the client should wait for the diff instead.
- Whether op handlers should be on by default once the interpreter size is known.
- Whether `Dom.reset` and `Dom.focus` take a CSS selector or a ref declared in the view.
- Whether keyed paths should accept compound keys.

## Later

These came out of the same review and need their own proposals:

- **Model pruning.** Write into the HTML only the model paths that the view or the page's handlers read. Load the rest when a handler that needs it loads.
- **Server handlers.** A handler marked `server` runs on the server. The client sends the message over `fetch` and applies the returned model patch.
- **`machine()` for UI modes.** A function component primitive for finite modes such as `idle`, `saving` and `error`. It compiles to a model field and guarded handlers. The compiler can then reject impossible transitions. The client can prefetch handlers for events that do not come from the DOM, such as command results.

## Alternatives

- **Signals instead of MVU.** Runtime tracking handles dynamic reads with no analysis. The client must resume the graph from signals to bindings, either from the HTML or by rebuilding it on load. Handlers also capture closures that the compiler must serialize. Rejected for the core. Runtime tracking stays as the fallback for `dynamic` holes in 0002.
- **Runtime diff only.** Keep the current order and rely on `prefetch`. Simpler, but prefetch then has to guess which binding chunks a message needs, and every handler still costs a chunk request.
- **Statecharts as the core.** They fit finite UI modes but add ceremony for list and form data, which is most of a model. Kept as the optional `machine()` primitive under Later.

## Prior art

- Qwik serializes the graph from signals to bindings into the HTML, so each update knows its targets. Write sets get the same targets from analysis, with nothing written into the HTML.
- Phoenix LiveView and Hotwire name events in the DOM and read form data on submit. `event.form` follows the same idea on the client.
- Immer and lens libraries describe updates as paths and operations. Update ops apply that to compiled output.
