# Outcome: fix-rows-collision

## Built

- `getLocalName` in `packages/idlip/src/compiler/view/codegen/text.ts` follows one rule. A reserved name or a name that holds `$` gets a trailing `$`. Generated locals never have that form: helpers are `name$` aliases, list accumulators in `html.ts` are `$rows`, `$rows2`. The helper names are no longer in the reserved set, so a state field `text` stays `text`.
- `packages/idlip/test/compiler/view/codegen/locals.test.ts`: a state `rows` in a list, and state named `path`, `out`, `el`, `start`, `branch`, `rows$`, `text$`, rendered through the generated server module.

## Proof

- base: 5af6ce3, `pnpm --filter idlip exec vitest run test/compiler/view/codegen/locals.test.ts`: the `rows` test fails with `SyntaxError: Identifier 'rows$' has already been declared`.
- branch: same command: 2 tests pass. `pnpm --filter idlip test`: 33 files, 521 tests pass.

## Deviations

- None.

## Stubs left

- None.

## Gotchas

- A new generated local must not end in `$` unless it is a helper alias, and must not start without `$` unless `getLocalName` cannot return it.

## Proposed learnings

- Generated locals use a form `getLocalName` never returns | one rule instead of a list of reserved names | packages/idlip/src/compiler/view/codegen | yes

## Verification

- `pnpm --filter idlip test`: passed (521 tests).
- Full check: passed (build, lint, format:check, typecheck, test, e2e).

## Size

- Estimated S, actual S.
