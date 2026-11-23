# Outcome: perf-list-kept

## Result

Main-thread script time per operation fell 47% for select and 19% for remove (cpu metric, 21 runs, interleaved, noise 0.3 and 1.1 ms). Click-to-paint is unchanged, because each operation is under one frame. Swap (-15%), update every 10th (-15%), clear (-21%) and append (+2%) are within noise. The cpu metric was chosen after the paint run showed the frame floor; all runs are in `log.md`.

The acceptance is partly unmet: swap, update every 10th, clear and append are not faster beyond the noise in the final run. The skip of unchanged kept rows, which made swap faster, is removed because it was wrong (see Deviations).

## Built

- `client/list/index.ts`:
  - Each row keeps its node map on its start marker (`rowNodes`), with the block count of that walk (`rowCount`). The row is walked again only when a block was added since. A binding absent from an inactive branch costs no walk.
  - One recursive walk (`indexNode`) builds the map, without the node array.
  - `readRows` is one loop with a depth counter; a stray `/i` at depth 0 is skipped.
  - Removed rows are walked for blocks only when `rowHooks > 0`.
  - The `A row has no markers` check is gone; `client/CLAUDE.md` now states that rows start and end with their markers.
  - A chosen row binding still runs on every kept row (v9 rule).
- `client/patch/blocks.ts`: `addCount` (bumped by `addBlock`), `rowHooks`, and the internal `onPageBlock`. The public `onBlock(add, remove)` is unchanged and counts as a row hook. `client/patch/nodes.ts` registers `forgetNodes` with `onPageBlock`.
- `client/patch/diff.ts`: the list path at a `*` is `segments.slice(0, at).join('.')`, with no prefix argument (a loader byte cut).
- `client/patch/patch.ts`: same as `batch/core`.
- `benchmarks/harness/profile-rows.mjs`: profiles any rows operation after its own warmup.
- Tests, `test/client/list/kept-rows.test.ts`, each run with a field key and a computed key:
  - an outside path (`selected`) on every row, counting `class` writes;
  - a keyed path in a row (`rows[id=selected].label`);
  - the index after a remove;
  - swap;
  - a nested list whose outer item changed;
  - a branch rendered again after its nodes were cached;
  - the walk count (no `i-a` reads over two patches while no block is added);
  - rows that read other items of their list (`rows[first]`, `find`).
- Change request: `contracts/compiled-format-perf-list-kept.change-request.md` asks for a compiler mark on groups that read only their own row item, so a later node can skip unchanged kept rows safely.
- `client/CLAUDE.md`: rules for the row binding rule and why, the node cache and `addBlock`, the row markers, and `onPageBlock`.

## Proof

Final A/B: `rows-ab.mjs --runs 21 --metric cpu`, base `batch/core` against the final code (`cache`). N was fixed before the run, and the run waited until the 1-minute load was under 3 (2.68 at the start, 4.15 at the end). Median (MAD) in ms; noise is 3 × the larger MAD.

| Op                | base       | final      | Change | Noise | Verdict      |
| ----------------- | ---------- | ---------- | -----: | ----: | ------------ |
| select            | 3.5 (0.0)  | 1.9 (0.1)  | -46.9% |   0.3 | real         |
| swap              | 10.2 (1.2) | 8.7 (0.8)  | -14.5% |   3.6 | within noise |
| remove            | 9.7 (0.3)  | 7.9 (0.4)  | -19.1% |   1.1 | real         |
| update every 10th | 14.0 (0.4) | 11.9 (0.9) | -15.0% |   2.6 | within noise |
| clear             | 4.9 (0.6)  | 3.9 (0.2)  | -20.6% |   1.9 | within noise |
| append            | 41.9 (0.8) | 42.8 (1.3) |  +2.1% |   3.8 | within noise |

- A synchronous `patchRow` was measured in the same run (+38 B). It was within noise of the final code on every operation, so the smaller code was kept.
- The first round's runs measured the code with the skip, which is now removed. Its paint run and cpu run (select -44%, swap -35%, remove -41%, clear -21% real) are in `log.md` for the record; they are not the shipped code.
- Profile of the base, list and patch code in ms per round: select 4.9, swap 7.5, remove 6.5, update every 10th 6.7, clear 6.6, append 14.0. Of these, `walk` plus `findNodes` was 2.3 to 3.5 ms on select, swap, remove and update every 10th, and `collectBlocks` was 1.4 ms on clear. The node cache and the row hook count remove those costs.
- The brief's verify command (`pnpm --filter idlip test && pnpm -C benchmarks/harness bench --scenario rows --only idlip,marko --rounds 1`) was run; see Verification.

## Deviations

- **The skip of unchanged kept rows is removed.** The manifest gives the same `rows.*.label` path for a row's own item (`r.label`) and for another item of the list (`rows[first]?.label`, or `rows.find((x) => x.label === r.label)`). After a swap, the skipped rows showed stale text. With a computed key, `rows.find((x) => x.id === selected)` also becomes a `rows.*` path. Skipping needs a compiler mark; this is the change request above.
- The clear and remove gain from skipping the block walk holds only while no row-aware hook is registered. The nesting (`HAS_CHILDREN`), head (`HAS_HEAD`) and subs (`HAS_SUBS`) hooks register with `onBlock`, so apps with those flags still walk every removed row.
  - Scoping those hooks needs to know whether any row holds such a block. Only the list chunk's `blocks` flag says so, and the chunk is not loaded on a clear, so this was not done.
- Edited `client/patch/nodes.ts` (one line), which is outside the owned paths.
- Read `nodes/perf-list-create/log.md` in the first round, against the roadmap rule of reading only outcomes.
- Brumate's lessons checked against the code:
  - a longest increasing subsequence for moves was already there (`getStayers`);
  - freshly rendered rows already skip the binding pass;
  - nothing walks cloned rows after insert.
- Not shipped:
  - a synchronous `patchRow` (within noise of the final code);
  - removing runs of rows with `Range.deleteContents` (happy-dom left markers behind in two differential subjects).

## Gotchas

- A path under `<list>.*` in a row binding does not mean the binding reads its own item.
- Code that changes a row's markup must call `addBlock`, or the row's cached nodes go stale. `setBranch$` and `failRegion` do.
- `rows-ab.mjs --metric paint` floors at one frame for operations under about 15 ms. Compare those with `--metric cpu`.
- In select and remove profiles, 14 to 17 ms of `matches` and `parentElementOrShadowHost` is Playwright resolving the click selector, not idlip code.

## Verification

- `pnpm --filter idlip build && pnpm --filter idlip test`: 834 passed, 29 skipped.
- `tsc --noEmit`: clean.
- The brief's verify command passed. The bench ran in 512 s, starting at load 4.86, so the times are noisy and not part of the verdict. Main thread from click to paint, idlip against Marko, in ms:
  - select 1.9 against 1.1;
  - swap 8.8 against 6.9;
  - remove 8.1 against 7.1;
  - update every 10th 12 against 11;
  - clear 3.7 against 2.8;
  - append 42.5 against 31.
  - The first round's `bench-rows` numbers were select 4.3, swap 9.7, remove 11.4, update 13.5 and clear 5.1, measured under other load.
- Website build and its 135 tests pass.
- e2e: 27 passed, the loader budget test included.
- Benchmark builds and the 16 harness tests pass.
- `pnpm lint` exits 0, and `oxfmt --check` is clean.
- Mutation checks:
  - Re-walking on a missing name fails the walk-count test.
  - Never re-walking fails the branch test, the walk-count test and the nested-list swap test.
  - The skip rule fails both "other items" tests.

## Size

- Todo loader, node gzip -9 of the built file from a clean `dist`: 4044 B to 3991 B (-53 B; the budget is 4096 B).
- Estimated M, actual M.
