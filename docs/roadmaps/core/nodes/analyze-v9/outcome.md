# Outcome: analyze-v9

## Built

- Event modifiers in `packages/idlip/src/compiler/view/analyze/analyze.ts` (`readEventBody`, `readKeyFilter`): `e.preventDefault();` and `e.stopPropagation();` before one handler call give `prevent` and `stop`. `if (<key test>) <call>` or `if (<key test>) { <prevent/stop> <call> }` gives `{ kind: 'key', filter }` first, then the prevent/stop modifiers. Filters are written `Ctrl+Alt+Shift+Meta+<key>`. A repeated `e.preventDefault()` or `e.stopPropagation()` is `event-closure`. Any other block body, modifier statements before an `if`, an `else`, or another test stays `event-closure`.
- New rules: `attr-reserved` (author attribute starting with `i-`), `event-placeholder` (event argument that reads the event other than as a whole member path), `html-raw-text` (hole in `<script>`/`<style>`, or in `<textarea>`/`<title>` next to other content, also through conditions and `<For>`), `event-passive-prevent` (check exists; no source form gives `passive`, so it cannot fire yet).
- `html-nesting` for text holes in table parts across `<For>` and condition blocks already held; fixture cases now cover a direct hole, a condition and a `<For>`.
- `handler-mutate` through aliases (coordinator request): a local initialized from a state value, a member or element of one (`const t = todos[0]`, `const [a] = todos`, `todos.find(...)`, `.at()`, `.findLast()`) or bound by `for (const t of todos)` is an alias. A write, `++` or mutator call through an alias or a member of it is `handler-mutate`. A copy (`{ ...todos[0] }`) is not an alias. Aliases belong to the declaring scope, so a parameter or block-scoped local that shadows one is not flagged. `let t; t = items[0];` makes `t` an alias. Known gaps: aliases through other calls (`items.filter(Boolean)[0]`) and passing an alias to a function that mutates it.
- `print.ts` prints modifiers (`modifiers prevent key:Escape`); the `ir.ts` comment is updated.
- Tests: new fixture `events.idlip.tsx.txt`, cases in `violations.idlip.tsx.txt`, snapshots `expected/events.txt` and `expected/compiled-format-todo.txt`. `analyze.test.ts` checks the modifiers, 0 diagnostics for the compiled-format todo source, and that hole ids and path sets match `test/fixtures/todo/expected/manifest.json` (binding ids a0 to a7, t2, t6, l3; the event payload takes the id after the last hole).

## Deviations

- None. `event-passive-prevent` is exempt from the "fires on a fixture" test, like `hole-dynamic`, because no source can produce it.

## Stubs left

- None.

## Gotchas

- `Event.modifiers` order is key first, then prevent/stop in source order. Codegen applies `key` first, as compiled-format says.
- The alias walk is by name within the declaring scope; a conditional alias assignment (`if (c) t = items[0]`) still counts as an alias afterwards.

## Proposed learnings

- None.

## Verification

- `pnpm --filter idlip exec vitest run test/compiler/view/analyze`: 98 passed.
- `pnpm --filter idlip test`: 134 passed.
- `pnpm typecheck`, `pnpm format:check`: clean. `oxlint --type-aware`: 0 errors, warnings only (`no-thenable` on the contract's `then` field, one template string in a test).

## Size

- Estimated S, actual S.
