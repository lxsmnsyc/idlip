# Proponent round 1 evidence (option A, Elm-like component structure)

## Sketch: todo in option A (markup stays JSX-like with # blocks)

```
import { countLeft } from './todo.ts'        // plain TS helpers, pure
type Todo = { id: string; text: string; done: boolean }

props { initial: Todo[] }

model {
  draft: string = ''
  todos: Todo[] = props.initial
  next: number = props.initial.length + 1
}

derived { left = countLeft(todos) }

msg SetDraft(text: string)
msg Add
msg Clear
msg Toggle(id: string)

update {
  SetDraft(text) -> { draft = text }
  Clear          -> { draft = '' }
  Add            -> draft === '' ? {} : { todos = [...todos, { id: `t${next}`, text: draft, done: false }], next = next + 1, draft = '' }
  Toggle(id)     -> { todos[t => t.id === id].done = !it }
}

view
<main>
  <form on:submit.prevent={Add}>
    <input value={draft} on:input={SetDraft(event.currentTarget.value)} on:keydown.escape={Clear} />
    <button disabled={draft === ''}>Add</button>
  </form>
  <p>{left} left</p>
  <ul>
    #for (t of todos by t.id) {
      <li class={{ done: t.done }}><input type="checkbox" checked={t.done} on:click={Toggle(t.id)} />{t.text}</li>
    }
  </ul>
</main>
```

Same todo today: examples/todo/src/todo.idlip.tsx (export default function, `import { For }`,
`import type { JSX }`, `(t) => (...)` render callback, event arrows `() => toggle(t.id)`,
a file-level oxlint-disable for two rules).

## What already is MVU under the hood (measured, batch/core)

- docs/proposals/0002-modules.md:16 "MVU stays after compilation": one serializable model,
  every change a named message `{ t, p }` (line 130), compiled update functions are pure
  functions of model and message.
- GOAL.md Constraints: "MVU concept, not Elm's API"; "Models, messages, commands and
  subscriptions are plain data".
- view IR (packages/idlip/src/compiler/view/analyze/ir.ts, contract view-ir v8): Path roots
  `state` | `props`; Target `handler`; Expr is already a closed grammar.

## Size of the parts (wc -l, batch/core)

| part                                                      | lines | fate under A                                                             |
| --------------------------------------------------------- | ----- | ------------------------------------------------------------------------ |
| compiler/view/analyze/analyze.ts                          | 3,916 | rewritten: front end from function body to IR                            |
| compiler/update (handlers, writes, segments, tasks, emit) | 2,402 | handlers.ts+writes.ts (1,364) rewritten; emit/segments/tasks mostly kept |
| compiler/view/codegen                                     | 3,429 | kept (consumes view IR)                                                  |
| client                                                    | 2,649 | kept                                                                     |
| server                                                    | 428   | kept                                                                     |
| core                                                      | 1,199 | kept                                                                     |
| vite                                                      | 973   | kept, file suffix change                                                 |
| testing                                                   | 497   | kept, mount API takes new modules                                        |
| jsx + jsx-runtime                                         | 311   | removed or moved to virtual-file types                                   |

Kept: about 9,175 of 16,876 lines (54%) untouched by the front end swap; rewritten about 5,280.

## Rule ids that exist only because a component is a TS function body (from evidence/tsx.txt, 83 ids)

Function-body shape (vanish: model/msg/update are declarations, not statements):
body-destructure, body-return, body-statement, body-var, let-annotation, let-bare-as, let-init,
let-unassigned, init-scope, props-count, props-pattern, props-whole, derived-jsx (13)

Handlers as closures and arrows (vanish: an event value is a message constructor, data by syntax):
event-closure, event-param, event-placeholder, hole-closure, hole-function-value, hole-handler,
handler-assign, handler-generator, handler-mutate, helper-closure (10)

JSX-as-expression and block components as fake control flow (vanish with # blocks and markup only in view):
attr-jsx, hole-jsx, jsx-spread, for-each, for-param, for-render, try-catch, condition-operator,
view-map, subscribe-children (10)

Total: 33 of 83 (40%) police a source language larger than the semantics. The rest (html-_,
hole-_ expression grammar, derived-cycle, ref-_, title-outside-head, srcdoc/html-trusted,
global-_, await-*) are semantic and carry over.

let-annotation exists for `let x = v satisfies T as T` (0002-modules.md:116): TS narrows an
annotated let to its initial value inside the function that also holds the view. A model
declaration `save: SaveState = { state: 'idle' }` has no such narrowing.

## Port size (measured)

- 27 *.idlip.tsx modules; 7 are docs spike/prototype history (stay). 20 live modules, 969 lines.
- 21 test files under packages/idlip/test build components inline, about 89 `export default function` sources.

## Cost estimate (calibration J9: M 145k-365k; v1 J2: 7 nodes 994k)

| node                                                                              | size    | tokens                       |
| --------------------------------------------------------------------------------- | ------- | ---------------------------- |
| elm-spec: contract + fixtures for all 31 landed features                          | M       | 250k                         |
| elm-parser: constructs + markup (reuse v1 scan/parse 1,421 lines)                 | M       | 200k                         |
| elm-view: view to view IR v8                                                      | M       | 300k                         |
| elm-update: msg/update to handler IR, write sets from field updates               | L       | 400k                         |
| elm-effects: commands, subscriptions, await split                                 | M       | 300k                         |
| elm-types: virtual TS for Volar, tsc, language server, vscode (reuse v1 packages) | M       | 300k                         |
| elm-ts-plugin (already a node: markup-ts-plugin)                                  | M       | 200k                         |
| elm-port: 20 modules + 89 inline test sources + goldens                           | L       | 500k                         |
| elm-only: delete analyze.ts, handlers.ts, jsx; docs 0001/0002/0005, GOAL          | M       | 250k                         |
| total                                                                             | 9 nodes | about 2.7M (range 2.2M-3.4M) |

Critical path: spec -> parser -> (view | update | types) -> effects -> port -> only: 6 waves.
This run landed 31 nodes in 9 waves at 4-5 workers (J1, J8).
