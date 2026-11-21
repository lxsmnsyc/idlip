# Outcome: fix-global-late-listener

## Built

- `packages/idlip/src/compiler/view/codegen/plan.ts`: `bindEvents` takes the global target. An event of a `<window>` or `<document>` is listed as `type:window` or `type:document` in `manifest.events`. `listens` keeps the bare type.
- `packages/idlip/src/client/loader/listener.ts`: `add()` adds a window or document listener for a `:window` or `:document` token, at record time, and no document delegation for it. Other tokens add no global listener. A global element that a patch inserts later is heard.
- `packages/idlip/test/client/global/late.test.ts`: `listens on window ...` and `listens on document for an event type that was not on the page at load`.
- `packages/idlip/test/client/loader/listener.test.ts`: new test `adds no window or document listener for a type no global element uses`; the two global tests use the new tokens.
- `contracts/compiled-format.v13.change-request.md`: the token format.
- `website/docs/global-events.md`: the Limit bullet is gone and the Resume bullet describes the per-type listener.

## Proof

- base: batch/core e554ee2, `pnpm --filter idlip exec vitest run test/client/global/late`: 2 failed (output `0`, expected `1`).
- branch: same command: 2 passed.

## Cost

- A page whose modules have no `<window>` or `<document>` adds no global listener and runs no extra query. The test above checks it.
- A page with a global element adds one listener per global event type, as before.
- Inline listener script: 970 B before, 991 B after (budget 1024 B). Todo loader module: unchanged (3913 B before, budget 4096 B); the e2e `loaderBudget` test passes.

## Deviations

- Edited tests outside the owned paths: `test/client/loader/listener.test.ts` (tokens, one new test) and `test/compiler/view/codegen/codegen.test.ts` (`manifest.events` is `["keydown:window"]`).
- Edited `src/compiler/view/codegen/plan.ts`, outside the owned paths, for the token. No other compiler output changes without a global element.
- The contract text is not edited; the change request is written.

## Stubs left

- None.

## Gotchas

- `manifest.events` now has tokens with a suffix. Code that reads it as plain event types must strip `:window` and `:document`. Nothing in `src` does today.
- `pnpm lint` through the rtk wrapper prints a JSON parse error and exits 1. Use `rtk proxy pnpm lint` for the real exit code.

## Proposed learnings

- None.

## Verification

- `pnpm --filter idlip test`: 666 passed. `pnpm --filter e2e test` (ports 4973 to 4975): 18 passed.
- `rtk proxy pnpm lint`: exit 0, warnings only. `pnpm build`, `pnpm format:check`, `pnpm typecheck`: see the final run in the report.

## Size

- Estimated S, actual M: the second design touches the compiler and needs a change request.
