# Proponent round 2 evidence (option A after J12, O1, O3, O4)

## Revised sketch: update arms are TS statement blocks (J12, O1)

```
import { countLeft, save } from './todo.ts'
type Todo = { id: string; text: string; done: boolean }

props { initial: Todo[] }

model {
  draft: string = ''
  todos: Todo[] = props.initial
  next: number = props.initial.length + 1
  saving: { state: 'idle' } | { state: 'saving' } | { state: 'failed'; error: string } = { state: 'idle' }
}

derived { left = countLeft(todos) }

update {
  SetDraft(text: string) { draft = text; }
  Toggle(id: string) { todos = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)); }
  async Save() {
    saving = { state: 'saving' };
    try { await save(todos); saving = { state: 'idle' }; }
    catch (e) { saving = { state: 'failed', error: String(e) }; }
  }
}

view
<ul>
  #for (t of todos by t.id) {
    <li><input type="checkbox" checked={t.done} on:click={Toggle(t.id)} />{t.text}</li>
  }
</ul>
<button on:click={Save}>Save</button>
```

Each arm body between `{` and `}` is a TS function body, parsed by oxc as today.
`saving` is declared with its type; today it needs `let saving = v satisfies T as T` (0002-modules.md:116).

## Where analyze.ts changes (measured, method sizes by line distance)

Rewritten or replaced (reads the function-component shape or closure events):

- analyzeComponent 275 (props param, let/const/function scan, return)
- createHole event part, lines 1184-1263 (event-closure, event-param) about 120
- lowerBlock 262 (reads <For>/<Try>/<Head>/<Subscribe> components; # blocks give the same IR node kinds)
- readModule 48, readComponents 18, lowerDerived 24, isStateless and props pattern helpers about 60
  Sum: about 800 of 3,916 lines (20%).

Reused unchanged, fed with model fields as state and arm names as handlers:

- analyzeHandler 551 (handler-assign, handler-mutate, await placement stay as rules)
- lowerElement 163, lowerChild 167, lowerJsx 86, lowerBranch 67, lowerCall 155, lowerReference 148,
  lower 132, collectPaths 98, lowerFind 45, keyed lists, raw text, trusted, globals
- compiler/update (handlers, writes, segments, tasks, emit): 2,402 lines unchanged (O1 is answered
  by keeping arms TS, so emitRange, findAwaitSites work on the same oxc AST).

v1 markup code that carries over (feat/markup-frontend): parse.ts 1,167 minus about 300 lines of
function-shape scanning (O4) = about 870; lower.ts 415 (# blocks to block-component JSX with
copy/synth segments); scan.ts 254; Volar plumbing 315 (O4).

## Tooling plan (answers O4)

Every fragment of an A file is TS or JSX, so the virtual TS file is built by copy-with-mapping
like v1, not by translating a template language like brumate's check.ts (1,295 lines):

```
import ...                              // copy
type Props = { initial: Todo[] }        // synth from props {}, field text copied
export default function $c(props: Props) {
  let draft!: string; let todos!: Todo[]; ...        // synth names, copied types; no initializer, so no narrowing
  const $init: { draft: string; todos: Todo[]; ... } = { draft: '', todos: props.initial, ... }  // copied values
  const left = countLeft(todos);                     // copy
  function SetDraft(text: string) { draft = text; }  // header synth, body copy
  async function Save() { ... }                      // copy
  const $msg = { SetDraft: (text: string) => ({ t: 'SetDraft', p: [text] }) as $Msg, ... }
  return (<> ...view after v1 lower.ts, message names resolved through $msg... </>);
}
```

New code: about 400 to 600 lines of shell lowering plus v1 lower.ts for blocks. Event attribute
types change from a handler to `$Msg`.

## Cost against O3's calibration

O3: current front end cost 1.24M base + 2.02M feature spend = 3.26M for about 6,300 lines.
A rewrites about 800 analyzer lines and adds about 1,000 to 1,400 (shell parser, IR adapter),
about 25% to 35% of that front end, so 0.8M to 1.2M at O3's rate. Plus:

| node                                                                 | size                | tokens                                                                 |
| -------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------- |
| spike (O9)                                                           | M                   | 200k                                                                   |
| elm-spec                                                             | M                   | 250k                                                                   |
| elm-front (shell parser, IR adapter, messages as event values)       | L, may split to 2 M | 800k to 1.2M                                                           |
| elm-types (virtual TS, tsc, server, vscode; merges markup-ts-plugin) | M + M               | 400k to 600k                                                           |
| elm-port (P5; merges markup-port)                                    | L                   | 500k                                                                   |
| elm-only (merges markup-only)                                        | M                   | 250k                                                                   |
| total                                                                |                     | 2.4M to 3.0M; subtract O7's 350k and O8's merged nodes already planned |

Waves: spike, spec, front with types in parallel, port, only = 5 waves (O6 counted 6).
