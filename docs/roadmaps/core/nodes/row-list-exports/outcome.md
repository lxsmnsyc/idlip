# Outcome: row-list-exports

## Built

- `emitGroupChunk` in `packages/idlip/src/compiler/view/codegen/chunks.ts` exports the `l<id>` of every list that holds a row binding of the chunk, and of the enclosing lists up to the outermost. An `l` already in the chunk, own or covered, is not emitted twice.
- Two tests in `packages/idlip/test/compiler/view/codegen/codegen.test.ts`: a flat list with `class={selected === t.id}`, and a nested list.

## Proof

- base: `ca4ac0e` with the tests only, `pnpm --filter idlip exec vitest run test/compiler/view/codegen`: 2 failed, 37 passed (before the review tests). The chunk lacks `export function l<id>`.
- branch: same command: 42 passed.

## Deviations

- None.

## Stubs left

- None.

## Gotchas

- A list id equals the binding id of its `l` binding, which the chain walk relies on.

## Proposed learnings

- None.

## Verification

- `pnpm --filter idlip test`: 230 passed. `pnpm format:check` and `pnpm typecheck` pass. `oxlint --type-aware`: existing warnings only. Golden fixtures (counter, todo) unchanged.

## Size

- Estimated S, actual S.
