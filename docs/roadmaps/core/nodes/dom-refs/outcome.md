# Outcome: dom-refs

## Built

- `src/core/dom.ts`: `Dom` (`focus`, `scrollIntoView`, `measure`, `reset`), `RefName`, `Rect`, `findRef`, `callDom`. Exported from `idlip`.
- `src/client/dom/run.ts`: `runAfter(page, calls)`, called by `runBatch` after the patch, behind `HAS_REFS`.
- `resume.ts`: `Root.after`, `apply` collects `step.after`, `isStep` accepts `$step`. `format.ts`: `Step.after`, `Step.$step`, `Step.task` optional, `After`.
- Compiler: `i-ref` written by `html.ts` (server and item templates), rule `ref-key` in `analyze.ts`, `findDomCalls` and the `Dom.measure` built-in in `tasks.ts`, `$after` handling in `handlers.ts` and `segments.ts`.
- `HAS_REFS` in `features.ts`, detector in `vite/features.ts`.
- Tests: `test/client/dom/dom.test.ts` (row ref, `ref-key`, focus, focus on an element the same message adds, missing ref, reset, measure, `await Random.id()` add), `test/client/dom/features.test.ts`. Source fixture `test/fixtures/refs/refs.idlip.tsx` (no goldens).
- Change requests: `compiled-format-refs`, `core-api-dom`, `view-ir-refs`.

## Acceptance

- [x] Server and item-template output carry `i-ref`, row ref covered by the refs source.
- [x] Focus on an element the same message renders works. A missing ref warns.
- [x] `await Dom.measure` gives the rect to the continuation.
- [x] Loader at most 4096 B gzip: 3950 B for the todo build (no refs, e2e budget test passes; 3926 B before this node). With refs the loader grows by about 550 B (4572 B against 4020 B in the minified test build).

## Deviations

- Edited `handlers.ts` and `tasks.ts`, which the brief does not list as shared, because the brief asks for the handler rewrite and the `emitBuiltinTask` site. Also edited `codegen` none beyond `plan.ts` and `html.ts`.
- No golden fixture for refs: `test/fixtures/refs/` holds the source only, and the tests compile it. The golden fixture machinery needs hand-written expected files.
- `After` is its own type, not `Task[]`, since an after call has no continuation.
- `Dom.measure` as a built-in task looks under the page root: `runTask` calls the task with `this` set to `page.root` (one line in `tasks/run.ts`, not an owned path). The public `Dom.measure` outside a handler uses `document`. A missing ref warns and resolves to `null`.
- The manifest has `after: true` when a handler has after calls (`Manifest.after`, set in `compiler/index.ts`), and `HAS_REFS` reads it.
- A state field named `rows` collides with the list accumulator `rows$` in the server render (not fixed, outside this node).

## Stubs left

- None.

## Gotchas

- A `Dom` call that is not a statement is `dom-call-position`.

## Proposed learnings

- Put a runtime-only effect of a handler in a step field, not a task | an after-patch call has no continuation | packages/idlip/src/client | no

## Verification

- `pnpm --filter idlip test`: 531 passed. `pnpm --filter idlip typecheck` clean.
- `pnpm build && pnpm --filter e2e test`: 10 passed.

## Size

- Estimated M, actual M.
