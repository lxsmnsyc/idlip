# Outcome: keyed-paths

## Built

- `packages/idlip/src/compiler/view/analyze/analyze.ts`: `lowerFind` lowers `list.find((t) => t.field === value)` (either side of `===`) on a state or props path to a path with a `keyed` segment. `isKeyedList` and `collectPaths` keep the segment in the path set when a `<For>` over that list has `key="field"` and the value is a state path with field names only. Otherwise the set gets `list.*.field` and the value's paths. `analyze` runs a second pass when a module has a `find` and a keyed `<For>`, since the `<For>` may follow the hole. `minimizePaths` also treats `todos` as a prefix of `todos[...]`.
- `print.ts`: a path prints `todos[id=selected].text`. The `ir.ts` comment is updated.
- `codegen/expr.ts`: prints `.find(($i) => $i.id === value)` and makes the later segments optional. `codegen/plan.ts`: the manifest path is `todos[id=selected]`.
- `client/patch/diff.ts`: `diffPaths` splits paths outside brackets and compares the item found by key in `prev` and in `next`. The key source is read from each model root. An item missing on one side is a change; missing on both is not; a reorder is not.
- `core/format.ts`: `getChunkFile` maps `binding=todos[id=selected].text` to `binding.todos(id~selected).text.js`.
- Tests: fixture `keyed` with snapshot `expected/keyed.txt`, and `test/client/patch/keyed.test.ts` (diff cases and `getChunkFile`).
- Change requests: `contracts/view-ir-keyed.change-request.md`, `contracts/compiled-format-keyed.change-request.md`.

## Deviations

- None. Only owned and shared paths changed.

## Stubs left

- Keyed writes (`$p` sources) are `keyed-writes`.
- A list reached through a loop variable (`t.items.find(...)`) never gets a keyed path; it falls back to `*`.
- Only arrow predicates of the form `x.field === expr` are accepted. A `function` expression or another test stays `hole-method`.

## Gotchas

- The second analysis pass discards the first pass's diagnostics, so the analysis must stay free of side effects outside the analyzer.
- The generated `find` parameter is `$i`.

## Proposed learnings

- None.

## Verification

- `pnpm --filter idlip exec vitest run test/compiler/view test/client/patch test/fixtures`: 198 passed.
- `pnpm --filter idlip test`: 365 passed. Existing fixtures and snapshots are unchanged.
- `tsc` in `packages/idlip` and `oxlint --type-aware`: no errors. The `examples/todo` typecheck needs a build of `idlip`. `format:check` flags another node's brief (`custom-effects`).

## Size

- Estimated M, actual M.
