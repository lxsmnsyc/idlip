# Outcome: perf-list-create

## Built

- Nothing shipped. The one-parse change (`splitRows` in `packages/idlip/src/client/list/index.ts`, `collectBlocks` exported from `patch/blocks.ts`) is on branch `wip/perf-list-create` (f4b3cea), because its gain is within noise and it grows the todo loader past the budget.

## Proof

- base: `batch/core` 9d42687. Profile of create: `parseHtml` 6.3 ms of 12.9 ms script a round; append 5.3 of 23.5 ms. Rows A/B medians (ms): create 36.1, replace 39.6, append 54.5, create 10,000 355.0. MAD 1.8, 3.8, 3.0, 28.5. Load average 6 to 14.
- branch: same command, interleaved, 7 runs each: create 34.1 (-5.5%), replace 33.4 (-15.7%), append 46.3 (-15.0%), create 10,000 276.4 (-22.1%). Noise (3 x MAD) 5.4, 11.4, 9.0, 85.5. All four are within noise. `parseHtml` drops from 6.3 to 4.5 ms (create) and 5.3 to 4.9 ms (append); total script time 12.9 to 12.6 and 23.5 to 21.8 ms.
- A second run with `--cpu 4` was swamped by load (MAD up to 1,092 ms): within noise.
- Todo loader gzip -9: 3,979 B before, 4,110 B after (+131 B), over 4096 B.

## Deviations

- Not shipped: the acceptance "faster by more than the noise" and "loader under 4096 B" both fail. No line added to `src/client/CLAUDE.md`.

## Gotchas

- Most of `parseHtml` is the native parser, not per-row setup. One parse saves about 1.8 ms of 6.3 ms on create.
- The todo loader is already at 3,979 B gzip; any added list code needs a flag or a cut elsewhere.
- A worktree outside the agent's own tree was removed by cleanup mid-run; keep A/B base trees inside the worktree.
- On a busy machine compare `profile-rows.mjs` script time, or rerun with the load average under 3.

## Verification

- `pnpm --filter idlip test`: 660 pass on the wip branch.
- Rows A/B and profile as above. e2e not run.

## Size

- Estimated M, actual M.
