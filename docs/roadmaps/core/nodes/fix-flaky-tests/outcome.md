# Outcome: fix-flaky-tests

## Built

- `packages/idlip/test/testing/settled.test.ts`: `gated()` waits for the chunk gate before `release()`.
- `packages/idlip/test/client/list/list.test.ts`: `setRange` stops only at a comment node. The property test has a fixed example for the old counterexample.
- `packages/idlip/test/client/tasks/tasks.test.ts`: the fixed 80 ms `settle()` is replaced by `until(condition)` and `resumed.settled()`.

## Proof

Load for every run: 16 busy loops on top of the other agents (load average 25 to 32), three parallel loops of 25 runs per file. See `log.md`.

### settled.test.ts

- repro: `cd packages/idlip && npx vitest run test/testing/settled.test.ts --sequence.shuffle`
- before: 11 of 75 failed, `scope.idlipGates[chunk] is not a function`.
- after: 0 of 75.

### list.test.ts

- repro: `cd packages/idlip && npx vitest run test/client/list/list.test.ts --sequence.shuffle`. fast-check seeds `-618579107` and `-229314448`. The shrunk counterexample `[add "/t", toggle]` fails on every run with the old `setRange`.
- before: 2 of 75 failed under load. The failure does not depend on load, only on the generator reaching the text `/t`.
- after: 0 of 75. With the old `setRange` put back, the new example entry fails on every run.

### tasks.test.ts

- repro: `cd packages/idlip && npx vitest run test/client/tasks/tasks.test.ts --sequence.shuffle`
- before: not reproduced, 0 of 105. The cause is read from the code: a fixed 80 ms wait for chunk imports.
- after: 0 of 75.

## Deviations

- None. No code bug found. Both reproduced flakes were test bugs.

## Stubs left

- None.

## Gotchas

- `idlipGates` in `test/client/loader/helpers.ts` is replaced on each `setup()`. Read it from `globalThis` on every check, do not keep a reference.

## Proposed learnings

- Wait for the state an assertion needs, not for a fixed time | a chunk import takes as long as the machine allows | packages/idlip/test | no
- A property test keeps the shrunk counterexample as an `examples` entry | the generator may take hundreds of runs to reach it again | packages/idlip/test | yes

## Verification

- Verify loop (`pnpm --filter idlip test` 10 times): 10 of 10 passed.
- `pnpm build`, lint (0 errors), `pnpm format:check`, `pnpm typecheck`, `pnpm test` (533 passed), `pnpm --filter e2e test` (10 passed).

## Size

- Estimated S, actual S.
