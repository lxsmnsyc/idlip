# Log: perf-list-create

- Base `batch/core` 9d42687. Machine Apple M2, 8 cores. Load average 6 to 14 during the runs (other agents ran benchmarks and e2e).
- Profile (`profile-rows.mjs idlip create|append 10`, unminified build): create `parseHtml` 6.3 ms of 12.9 ms script a round; append `parseHtml` 5.3 ms of 23.5 ms. `collectBlocks` 0.8 and 1.1 ms. The cost is real, but about half of it is the native HTML parse.
- Branch (one parse for all new rows, `splitRows` with one block walk): create `parseHtml` 4.5 ms, total 12.6 ms; append `parseHtml` 4.9 ms, total 21.8 ms. Per-row template and `innerHTML` setup is gone; the parse itself stays.
- A/B, interleaved base and branch, 7 runs each (driver script in the session scratchpad, harness `--metrics browser --no-build --runs 5`, noise = 3 x larger MAD, the `bench.py` rule). Medians, ms:
  - Create 1,000: 36.1 to 34.1 (-5.5%), noise 5.4, within noise.
  - Replace 1,000: 39.6 to 33.4 (-15.7%), noise 11.4, within noise.
  - Append 1,000: 54.5 to 46.3 (-15.0%), noise 9.0, within noise.
  - Create 10,000: 355.0 to 276.4 (-22.1%), noise 85.5, within noise.
- Second A/B with `--cpu 4`, load average up to 14: all four within noise (MAD 35 to 1,092 ms).
- Todo loader, gzip -9 of `examples/todo/dist/client/assets/loader.*.js`: base 3,979 B, branch 4,110 B (+131 B). Over the 4096 B budget.
- `pnpm --filter idlip test`: 660 tests pass (one added for block hook order). e2e not run.
- Code kept on branch `wip/perf-list-create` (f4b3cea). Not in the shipped commit.
