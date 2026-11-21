# Outcome: stock-sources

## Built

- `packages/idlip/src/core/time.ts`: `Time` (`now`, `sleep(ms, signal?)`) and `until(signal, promise)`.
- `packages/idlip/src/core/random.ts`: `Random` (`id`, `number`).
- `packages/idlip/src/sources/`: `timer`, `socket`, `eventSource`, `media` and the shared `listen` bridge in `channel.ts`.
- All exported from `packages/idlip/src/index.ts`.
- Tests: `packages/idlip/test/sources/sources.test.ts`, 14 tests with fakes.

## Deviations

- None. The source names and types are in `contracts/core-api-sources.change-request.md`.

## Stubs left

- None.

## Gotchas

- A generator that never started does not run its body, so a source opens its handle on the first `next()`.
- A slow reader that was already waiting wakes after a burst of pushes and sees the buffer after dropping, not the first value.
- `socket` and `eventSource` yield text only, so each value serializes in the message log.

## Proposed learnings

- Build sources on `listen` so abort ends them without `return()` | an await outside the signal leaves a queued `return()` stuck | packages/idlip/src/sources | yes

## Verification

- `pnpm --filter idlip exec vitest run test/sources`: 14 passed.

## Size

- Estimated S, actual S.
