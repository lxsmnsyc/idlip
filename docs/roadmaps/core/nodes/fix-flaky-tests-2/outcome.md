# Outcome: fix-flaky-tests-2

## Built

- `packages/idlip/test/client/nest/harness.ts`: `settle()` is replaced by `harness.settled()`, the `settled` of `resume()`.
- `packages/idlip/test/client/loader/helpers.ts`: `settle()` is replaced by `harness.settled()`, `reached(chunk)` and `until(condition)`.
- `loader.test.ts`, `writes.test.ts`, `nest.test.ts`: use them. Gated tests wait for `reached(chunk)` before `release()`.
- `packages/idlip/test/client/tasks/effects.test.ts`: waits for the label it asserts with `until`, then `resumed.settled()`.

## Proof

Load for every run: 12 to 20 busy loops on top of the other agents (load average 18 to 30), three or four parallel loops per file. See `log.md`.

### nest.test.ts

- repro: `cd packages/idlip && npx vitest run test/client/nest/nest.test.ts --sequence.shuffle`
- before: 5 of 51 failed. The assertion ran before the chunks had loaded (`getCounts()` or `getLoaded()` too early).
- after: 0 of 52.

### loader.test.ts

- repro: `cd packages/idlip && npx vitest run test/client/loader/loader.test.ts --sequence.shuffle`
- before: not reproduced, 0 of 103. The cause is read from the code: a fixed 100 ms `settle()` and a fixed wait before `release()` of a gated chunk.
- after: 0 of 52.

### writes.test.ts ("reports a failed binding chunk through the patch, not the preload")

- repro: `cd packages/idlip && npx vitest run test/client/loader/writes.test.ts --sequence.shuffle`
- before: not reproduced, 0 of 52. Same fixed `settle()`.
- after: 0 of 52.

### effects.test.ts

- repro: `cd packages/idlip && npx vitest run test/client/tasks/effects.test.ts --sequence.shuffle`
- before: not reproduced, 0 of 103. Fixed 80 ms wait.
- after: 0 of 52.

## Deviations

- None. No code bug found. All causes are in the tests.

## Stubs left

- None.

## Gotchas

- `settled()` does not cover a task continuation: it is queued after the batch that started the task. A test of a task waits for the state it asserts.
- `harness.settled()` of the loader harness waits for a gated chunk. Use `reached(chunk)` before `release()`.

## Proposed learnings

- Wait for the state or for `settled()`, never a fixed time | a chunk import takes as long as the machine allows | packages/idlip/test | no

## Verification

- Verify loop (`pnpm --filter idlip test` 10 times): 10 of 10 passed (630 tests).
- `pnpm build`, lint, `pnpm format:check`, `pnpm typecheck`, `pnpm test` (630 passed), `pnpm --filter e2e test` (16 passed): all pass.

## Size

- Estimated S, actual S.
