# Log: fix-flaky-tests

## Repro

Load: 16 busy loops (`while :; do :; done`) on top of the other agents, load average 25 to 32. Each file looped 25 times in three parallel loops, `npx vitest run <file> --sequence.shuffle` from `packages/idlip`.

Before the fix (commit b34cb4d), 75 runs per file:

- `test/testing/settled.test.ts`: 11 of 75 failed. `TypeError: scope.idlipGates[chunk] is not a function` in `release()`, test "waits for a chunk load and the patch".
- `test/client/list/list.test.ts`: 2 of 75 failed. fast-check seeds `-618579107` (path `196:1:0:15:15:16`) and `-229314448` (path `116:1:1:1:2:2:18:19:19`). Counterexample `[add "/t" at 0, toggle at 0]`. Replaying the counterexample fails on every run, with or without load.
- `test/client/tasks/tasks.test.ts`: 0 of 105 failed (30 runs at load 11, 75 at load 25 to 32). Not reproduced.

## Causes

- settled: the test waited a fixed 20 ms and then called `release('handler=add')`. The gate is registered when the chunk module starts to import. Under load the import had not started yet.
- list: the test's `setRange` stopped at any sibling whose `data` is `/t`. A text node with the text `/t` has that `data`, so a todo named `/t` ended the range early. The generator reaches the 2-character string `/t` rarely, which looked like a flake. Test bug, not a bug in `patchList`.
- tasks: not reproduced. The test waited a fixed 80 ms (8 ticks of 10 ms) for chunk imports and then read `patch.mock.calls[0][2]`. A slow import leaves `calls` empty, which gives the reported undefined read. The same fixed wait is in every test in the file.

## Fixes

- settled: wait until the gate exists, then release.
- list: `setRange` stops only at a comment node. The property test has the counterexample as an `examples` entry.
- tasks: `settle()` removed. Each test waits for the state it asserts (`until`), and uses `resumed.settled()` where it asserts a count.

## After the fix

75 runs per file under the same load: 0 failures in all three files.
