# Outcome: errors

## Built

- Codegen for the `try` view node. A region is `<!--e<id>:<0|1>-->…<!--/e-->` (0 ok, 1 failed). `addTry` in `packages/idlip/src/compiler/view/codegen/html.ts` runs the body in a `try` block and writes the catch view when it throws. The same code runs in client templates (condition branches, row templates).
- `plan.ts`: `TryInfo`, `Plan.tries` and `Plan.tryIds`. Region ids count from 0 on their own counter, so other ids do not move.
- `chunks.ts`: `emitTryChunk` emits `try=<id>`, exporting `render(error, scope)`.
- `core/format.ts`: `Manifest.fallback` (region id to `try=<id>`). `vite/chunks.ts`: the `try` chunk kind in `CHUNK_QUERY` and `listChunks`.
- `reset` renders `on:click='["$reset",[<id>]]'`, a reserved tag with no handler chunk.
- Change request: `contracts/compiled-format-errors.change-request.md`.
- Tests: `packages/idlip/test/try/try.test.ts`, golden files in `packages/idlip/test/fixtures/try/` (rewrite with `UPDATE_TRY=1 pnpm vitest run test/try`).

## Deviations

- `src/server/try.ts` is not created: the server needs no helper, the generated code is inline (`$e instanceof Error ? $e.name + ': ' + $e.message : String($e)`). `src/server/render.ts` and `index.ts` are unchanged.
- Edited outside owned and shared paths: `src/compiler/view/codegen/expr.ts` (a `local` root prints as the local's name, for `error`), `src/vite/chunks.ts` (the `try` kind, which `src/vite/CLAUDE.md` requires), `test/compiler/view/codegen/codegen.test.ts` (a test asserted that `<Try>` is unsupported; it now asserts that it generates).
- The `try` fixture is in `test/fixtures/fixtures.test.ts`, whose `listChunks` now lists `fallback`. `test/try/try.test.ts` adds server and client-template checks.
- `<Try>` does not carry a namespace: a catch view in `<svg>` parses as HTML.
- The loader got nothing, so flag-off cost is 0 B. The todo goldens are unchanged.

## Stubs left

- No client runtime: nothing swaps a region, handles `$reset` or sets `HAS_ERRORS`. `errors-client` builds them.

## Gotchas

- The region id counts from 0 on its own counter. Chunks are `try=0`, `try=1`.
- Catch view holes have no bindings: the view does not follow the model until the runtime swaps again.
- `error` is a string. Compile with `let x = v satisfies T as T` in fixtures when lint needs a wide type.
- The failed state of a region in a row hides the body's bindings. A lookup that finds no node skips them (compiled-format, DOM encoding).

## Proposed learnings

- A new chunk kind needs `CHUNK_QUERY`, `listChunks` and the server `chunkNames` together | a kind one of them misses fails only in a build | packages/idlip/src/vite | yes

## Verification

- `pnpm --filter idlip test`: 584 passed.
- `pnpm build && pnpm --filter e2e test`: 14 passed.
- `pnpm lint`: no errors in `packages/idlip` (`examples/todo` typechecking errors appear on a build-less checkout and are not from this node).

## Size

- Estimated M, actual M.
