# Log: fix-rows-collision

- Wrote `test/compiler/view/codegen/locals.test.ts` and ran it on `batch/core` (5af6ce3) with `pnpm --filter idlip exec vitest run test/compiler/view/codegen/locals.test.ts`.
- Result: a state `let rows` used in `<For each={rows}>` fails with `SyntaxError: Identifier 'rows$' has already been declared`. `getLocalName` renames the state to `rows$`, and the list accumulator in `html.ts` is also `rows$`.
- A user name that already ends in `$` could also hit a helper alias (`text$`) or an accumulator.
- Fix: `getLocalName` adds a trailing `$` to a reserved name or any name that holds a `$`. Accumulators are `$rows`, `$rows2`, which that function never returns. Helper names left the reserved set, since helpers are already imported as `name$`.
