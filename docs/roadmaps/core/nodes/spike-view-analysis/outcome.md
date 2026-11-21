# Outcome: spike-view-analysis

## Built

- `prototype/analyze.ts`: an oxc pass (`oxc-parser` 0.154.0) that reads every function component in a `*.idlip.tsx` file and returns a `ModuleIR`: state fields with initial values, derived values, handlers with free variables, writes and `await` segments, the view tree, the path set per hole and diagnostics with rule ids. `node analyze.ts <file> [--json]` prints one file.
- `prototype/ir.ts`: the IR types. `prototype/nesting.ts`: the HTML nesting rules, ported from brumate's `nesting.ts` (BRM185) plus the implied `<tbody>`, `<tr>` and `<colgroup>`.
- `prototype/fixtures/`: `todo.idlip.tsx` (0002 Example, verbatim), `counter.idlip.tsx`, `features.idlip.tsx` (every block and inlining case), `edges.idlip.tsx` (aliases, computed keys, helper-computed lists), `violations.idlip.tsx` (one case per rule, each marked with its rule id).
- `prototype/run.ts`: analyzes every fixture, writes `prototype/out/<name>.txt` (and `.json` for counter and todo) and prints counts and timings.
- `view-ir.proposed.md`: the v7 contract text, ready to freeze. `contracts/view-ir.change-request.md` asks the orchestrator to copy it over `contracts/view-ir.md`.

## Result

Spike. The question: can an oxc pass read a function component into state, derived values, handlers and a view, and compute each hole's path set? Yes, for every construct in 0002 and 0004.

- result: met. All 8 holes of the 0002 todo resolve to exact static paths with 0 diagnostics. Across the six fixtures, 103 holes resolve and none is `dynamic`. The analyzer defines 74 rule ids, and `violations.idlip.tsx` plus `parse.idlip.tsx.txt` fire 73 of them. `hole-dynamic` has no case, because nothing produces a `dynamic` hole.
- numbers (`node prototype/run.ts`, median of 20 runs after one warm-up, Node 26.12.1, Apple silicon):

  | Fixture    | Bytes | Holes | Dynamic |           Errors |  Median |
  | ---------- | ----: | ----: | ------: | ---------------: | ------: |
  | counter    |   572 |     3 |       0 |                0 | 0.13 ms |
  | edges      |  1307 |     8 |       0 |                0 | 0.18 ms |
  | features   |  5695 |    50 |       0 |                0 | 0.72 ms |
  | parse      |   140 |     0 |       0 |                1 | 0.01 ms |
  | todo       |  1718 |     8 |       0 |                0 | 0.19 ms |
  | violations |  6109 |    34 |       0 | 78 (+2 warnings) | 0.64 ms |

- reproduce: `cd docs/roadmaps/core/nodes/spike-view-analysis/prototype && pnpm install --ignore-workspace && node run.ts`. The printed IR is in `out/`.

### The todo's path sets

| Hole                                            | Paths                        |
| ----------------------------------------------- | ---------------------------- |
| `value={draft}`                                 | `draft`                      |
| `disabled={draft === ''}`                       | `draft`                      |
| `disabled={save.state === 'saving'}`            | `save.state`                 |
| `{left}`, where `const left = countLeft(todos)` | `todos` (helper: args)       |
| `<For each={todos}>`                            | `todos`                      |
| `class={{ done: t.done }}`, `checked={t.done}`  | `todos.*.done`               |
| `{t.text}`                                      | `todos.*.text`               |
| payload of `() => toggle(t.id)`                 | `todos.*.id`, read at render |

`setDraft(e.currentTarget.value)` records `$event.currentTarget.value`, read at dispatch. `add` splits into `add` and `add$1` after `await Random.id()`. `persist` splits after `await saveTodos(todos)` inside `try`. Neither carries a local across the `await`, because `const id = await ...` is the continuation's result, not a carried local.

### Exact paths

- State reads and member chains: `save.state`, `load.error`.
- Literal keys: `columns[0].cards` is `columns.0.cards`.
- Derived values, by inlining: `const heading = \`${LABELS[filter]} cards\``gives`filter`.
- Aliases, by inlining: `const list = items; <For each={list}>` gives item paths `items.*.name`. `const active = filter` gives `filter`.
- Props: `props.x` and props patterns `({ initial })` give `props.initial`.
- `<For>` items over a path, nested: `columns.*.cards.*.done`. Object pattern items `({ id, author })` give `columns.0.cards.*.author.name`.
- Helpers with one return expression in the closed grammar, inlined: `isVisible(card, filter)` gives `filter` and `columns.*.cards.*.done`. A module-level `const f = (x) => expr` counts too.
- Stateless components, inlined: props become the caller's expressions, `children` places the caller's nodes, and an `onPick` prop forwards the caller's `() => pick(card.id)`. `<CardRow card={card} />` in a nested loop gives `columns.*.cards.*.done`.
- Conditions: the test of a ternary or `&&` is its own hole, and chained ternaries nest.
- Template strings, object literals (`class={{ done }}`), arrays, `<Subscribe input key>` and event payloads.
- Allowed globals and methods: `String(ticks)` reads `ticks`, `heading.trim()` and `heading.length` read `filter` through the derived value.
- Props read by a handler: the counter's `reset() { count = props.start; }` records `props.start` as a payload field computed at render.

### Static but coarse (sound, never stale)

- Helper with a body other than one return (`countLeft(todos)`): the union of the argument paths, `todos`. Correct because updates are immutable.
- `<For>` over a helper result (`visible(items, query)`): rows read the paths of `each`, `items` and `query`.
- Computed keys: `items[index].name` gives `index` and `items.*.name`; `byId[selected]` gives `selected` and `byId.*`.
- The loop index: `{index + 1}` reads the list path.

### `dynamic`

None. Function components remove both sources the 0002 text names: aliases are `const` and inline, and there is no whole-model value to pass to a helper. Every expression is either in the closed grammar, and resolves, or outside it, and is an error. `dynamic-paths` only matters if the grammar is widened beyond the allow-list of pure globals and methods (see below).

### Compile errors

All rule ids are listed in `view-ir.proposed.md`, Diagnostics. The main groups:

- Body: any statement other than `let`, `const`, a function declaration, a type declaration and one final `return` (`body-statement`); `var`; destructuring in `let` or `const` (`body-destructure`); no `return`.
- `let` type rule: `let x: T = v` (`let-annotation`), bare `v as T` (`let-bare-as`), no initial value, an initial value that reads state, derived values or handlers (`init-scope`). A `let` never assigned is the warning `let-unassigned`.
- Holes: closures, methods outside the allow-list (`draft.split(',')`, `todos.filter(...)`), globals outside the allow-list (`JSON.stringify`), `Math.random()` (`hole-impure`), handlers as values, assignments, `await`, `new`, `in`, `instanceof`, bitwise operators, regex and bigint literals, unknown names, functions used as values, property access on a computed value.
- Helpers: closure arguments (`helper-closure`). A whole-model argument cannot be written any more, so it needs no rule.
- View: `.map()` in the view (`view-map`), a JSX branch after `||` or `??`, `<For>` without a string `key` or without one render arrow, wrong `ref` form, `html` without `trusted()` or with children, `<title>` outside `<Head>` and `<svg>`, spread props, unknown components, children passed to a stateful component.
- Events: any arrow other than one handler call, an unknown target, a destructured event parameter, `on:x` and `latest:x` on one element.
- Handlers:
  - free variables that are not state, derived values, props, handlers, imports, module bindings or known globals
  - assigning a derived value or a prop
  - in-place changes (`todos.push`, `mode.length = 2`)
  - `Math.random`, `Date.now`, `performance.now`, `crypto.randomUUID`, `crypto.getRandomValues`, `new Date()`
  - `await` inside `if`, loops, `switch`, `?:` or `&&`
  - an awaited callee that is not an import or a module function
- HTML: `html-nesting` for `<div>` in `<p>`, block elements in `<p>`, headings in headings, `<li>` in `<li>`, `<a>` in `<a>`, `<form>` in `<form>`, `<button>` in `<button>`, wrong children of table parts, and text in `<table>`, `<tbody>`, `<thead>`, `<tfoot>`, `<tr>`. `html-implied` for `<tr>` directly in `<table>`, `<td>` in `<table>` or a section, and `<col>` in `<table>`. `<li>` outside a list is not rewritten by the parser, so it is not reported.

### Destructuring and aliases

- Aliases resolve: `const list = items` is a derived value and inlines.
- Props patterns `({ a, b: c })` resolve. Defaults and rest in the props pattern are rejected (`props-pattern`).
- `<For>` item patterns `({ id, done })` resolve to item paths. Defaults and rest are rejected (`for-param`).
- Destructuring in the body (`const { length } = draft`, `let [a, b] = ...`) is rejected (`body-destructure`). It could resolve for `const`; rejecting keeps state one name per field.
- Destructured event parameters are rejected (`event-param`).

## Deviations

- The brief asks that `contracts/view-ir.md` "is frozen". The roadmap rules forbid a worker to edit contracts, so the frozen text is in `view-ir.proposed.md` and `contracts/view-ir.change-request.md` asks for the copy. Acceptance item 4 waits on that.
- Wrote `docs/roadmaps/core/contracts/view-ir.change-request.md`, outside the owned paths, as the worker rules require.
- The prototype is outside lint: the root `oxlint` config ignores `docs/**`. Its untyped AST access would otherwise add about 1250 errors.
- `parse.idlip.tsx.txt` has a `.txt` suffix because `oxfmt` cannot format a file that does not parse.
- The closed grammar in v6 lists comparison and boolean operators only. The prototype also allows arithmetic (`count + 1`, `index + 1`, `count % 2`), which the counter needs. v7 lists it.

## Stubs left

- None in shipped code. The prototype is not shipped. `compile-view-analyze` replaces it under `packages/idlip/src/compiler/`.

## Gotchas

- Imported components. Decided: the production analysis follows the import, reads the `.idlip.tsx` source and applies the stateless rule. An import that is not an `.idlip.tsx` component is `component-import`. The prototype reads one file: it checks the suffix and always emits a `child` block.
- Stateful children with JSX children are rejected (`child-children`). Slots for stateful components are not designed yet.
- Pure globals. Decided: `String`, `Number`, `Boolean` and `Math.*` except `Math.random`, the methods `trim`, `toUpperCase`, `toLowerCase`, `slice`, `includes`, `startsWith`, `endsWith`, `indexOf`, `join`, `at`, `padStart`, `padEnd`, `toFixed`, and `.length` on any value. Their paths are the receiver's and the arguments'. `draft.trim()` reads `draft`. Anything else stays an error.
- A `*` path in a hole outside a row (`items[index].name` gives `items.*.name`) asks the runtime to compare every item. Code generation may coarsen it to `items`.
- The free-variable walk does not follow aliases: `const list = todos; list.push(x)` in a handler is not caught as a mutation. A dev-mode freeze of the model would catch it.
- JSX text is trimmed with React's rules (`normalizeJsxText`). The server renderer must use the same rules, or the HTML and the template differ.
- Inlined helpers see only their parameters and module bindings. Module-level `let` is not tracked, so a helper that reads one would get wrong paths.
- `oxfmt` rewrites JSX children and adds `{' '}` around trailing comments. Fixtures that mark rules with comments should put the comment on its own line before the case.
- oxc ESTree: `satisfies T as T` is `TSAsExpression` over `TSSatisfiesExpression`. `on:click` is a `JSXNamespacedName`. Parentheses may show as `ParenthesizedExpression`; strip them everywhere.

## Proposed learnings

- A worker that must freeze a contract needs write access to it, or the brief should say "propose" | the rules and the brief conflict | `docs/roadmaps/` | no
- Path sets are minimal: drop a path whose prefix is in the set | updates are immutable, so the prefix changes too | `packages/idlip/src/compiler/` | yes

## Verification

- `node docs/roadmaps/core/nodes/spike-view-analysis/prototype/run.ts`: the table above.
- `pnpm format:check`: all files formatted. `run.ts` runs `oxfmt` on `out/` after it writes the JSON.
- `pnpm --filter idlip test`: 7 passed. The package was not touched.

## Size

- Estimated M, actual M. The prototype is about 3,200 lines after the review round and fit one session. The production `compile-view-analyze`, with tests ported from the fixtures, is likely L: the prototype skips cross-file component resolution, source maps for diagnostics, and an exhaustive grammar test matrix.
