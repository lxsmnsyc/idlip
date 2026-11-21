# Log: fix-flaky-tests-2

## Repro

Load: 12 to 20 busy loops (`while :; do :; done`) on top of the other agents, load average 18 to 30. Each file looped in three or four parallel loops, `npx vitest run <file> --sequence.shuffle` from `packages/idlip`. Base commit 035587c.

Before the fix:

- `test/client/nest/nest.test.ts`: 5 of 51 failed (three loops of 17). Seven different tests failed across those runs: client-added row (twice), same-key row, slot state, child click, rows move, slot that left the page, boundary gone. Each read the DOM or `getLoaded()` before the chunks had loaded.
- `test/client/loader/loader.test.ts`: 0 of 51, then 0 of 52 at higher load. Not reproduced.
- `test/client/loader/writes.test.ts` (holds "reports a failed binding chunk through the patch, not the preload"): 0 of 52. Not reproduced.
- `test/client/tasks/effects.test.ts`: 0 of 51, then 0 of 52. Not reproduced.

## Causes

- nest, loader, writes: `settle()` waited a fixed 100 ms (10 ticks of 10 ms) for chunk imports, patches and queued events. A slow import leaves the assertion reading the page too early. Seen in nest. The loader tests share the same wait, so the loader failures from the earlier load have the same cause. Gated tests waited a fixed time and then called `release()`, the same race `settled.test.ts` had.
- effects: a fixed 80 ms wait. `settled()` of the loader is not enough here, since a task continuation is queued after the batch that started the task. The test needs to wait for the state it asserts.

## Fixes

- nest harness: `settle()` removed. `harness.settled()` is the `settled` of `resume()`.
- loader helpers: `settle()` removed. `harness.settled()` for tests without a gate, `reached(chunk)` (waits until the gated chunk started) before the assertions of a gated test, and `until(condition)`.
- effects: `settle()` removed. `until(label)` for the state, then `resumed.settled()`.

## After the fix

Same load, 52 runs per file (four loops of 13): 0 failures in `nest.test.ts`, `loader.test.ts`, `writes.test.ts` and `effects.test.ts`.
