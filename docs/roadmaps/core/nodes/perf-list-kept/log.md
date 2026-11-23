# Log: perf-list-kept

Machine: Apple M2, 8 cores, 8 GB, Chrome 158, Node 26.12.1. Base `batch/core` de80d0b.

## Harness

- `profile-rows.mjs` only knew create, replace and append. It now takes any key of `OPERATIONS` in `client.mjs`, runs that operation's warmup on a new page each round and profiles the measured click only (commit f7d0207). `client.mjs` exports `snapshot` and `waitDone` for it.
- Profiles: `node benchmarks/harness/profile-rows.mjs idlip <op> 10`, unminified rows build (`vite build rows --minify false`), self time a round.
- In select and remove, `matches`, `parentElementOrShadowHost`, `_matchesSimple` and `_cached` (14 to 17 ms) are Playwright resolving the `tbody tr:nth-child(n) a` selector of the click, and `query :5815` / `(anonymous) :5813` are the harness's `waitForFunction`. They are not idlip code and are left out below.

## Profile on the base (load 2.3 to 3.2)

List and patch code only (sum of the functions in `client.js` and the helpers they call, plus native DOM calls they make), ms a round:

| Op          | List/patch | Top entries                                                                                                                            |
| ----------- | ---------: | -------------------------------------------------------------------------------------------------------------------------------------- |
| select      |        4.9 | `walk` 1.46, `findNodes` 1.36, `patchRow` 0.68, `patchList` 0.55, `isComment` 0.32, `readRows` 0.26, `isElement` 0.24                  |
| swap        |        7.5 | `findNodes` 1.47, `walk` 1.46, `setAttribute` 1.20, `patchRow` 0.99, `patchList` 0.58, `checkKeyed` 0.34, `setText$` 0.32              |
| remove      |        6.5 | `walk` 1.43, `findNodes` 1.24, `patchRow` 1.23, `setAttribute` 1.18, `patchList` 0.49, `checkKeyed` 0.31                               |
| update 10th |        6.7 | `findNodes` 1.94, `walk` 1.55, `patchRow` 0.62, `setText$` 0.50, `patchList` 0.50, `isComment` 0.41, `isElement` 0.41                  |
| clear       |        6.6 | native `remove` 3.50, `collectBlocks` 1.37, `removeRange` 0.38, `isComment` 0.38, `readRows` 0.31                                      |
| append      |       14.0 | `setAttribute` 2.53, `importNode` 1.64, `clone$` 1.59, `before` 1.32, `walk` 1.30, `patchList` 1.18, `patchRow` 1.05, `findNodes` 1.01 |

All six place their cost in the list and patch code, so none was dropped.

- Select: `rows._.id_selected` (`a1`, paths `rows.*.id, selected`) runs on 1,000 rows; each `patchRow` walks its row into a fresh `Map` (`walk`, `findNodes`).
- Swap and remove: the group `rows.*.id` changes by index, so its chunk (`t2`, `a4`, `a5`, `a1`) runs on all 1,000 kept rows, although no item changed. The two `setOn$` per row are the `setAttribute`.
- Update every 10th: `t3` runs on 1,000 rows, 100 items changed.
- Clear: each removed row is walked for blocks (`findInnerBlocks`), though the only remove hook in the app is `forgetNodes` of `patch/nodes.ts`, which does nothing for blocks in rows.
- Append: the kept-row pass (`walk`, `findNodes`, `patchRow`, part of `setAttribute`) on the 1,000 old rows.

## Contract

- Inputs: old and new item arrays, paired by key; the paths that changed in this patch; the chosen bindings.
- Output: the DOM equal to a server render of the new model (differential test).
- A row binding reads its row's item, the index, outer rows' items and paths outside the list. Updates are immutable, so an item that is the same reference has the same fields. The manifest says which paths each binding reads: a group's `paths` are the paths of each binding in its `bindings`.

## Changes tried

1. Skip kept rows whose item is the same reference when every chosen row binding changed only through paths under `<list>.*`. `patch()` decides it per list and passes `items` on the context. An index read gives the list path itself, which is outside the item, so index bindings still run on every row. First version kept a set of names per binding and filtered per binding (115 B gzip); a single flag per list is the same for every case where a chunk loads one outside path, and 28 B smaller.
2. Keep each row's node map on its start marker; refind when a cached node is not `isConnected`. `parentNode` is not enough: a text marker inside a swapped-out branch keeps its parent `<b>`. The new test "finds the nodes of a branch that a later patch rendered again" fails with `parentNode`.
3. Skip the block walk of removed rows unless a hook acts inside rows (`onBlock(add, remove, true)` for `forgetNodes`).
4. Synchronous `patchRow` that returns a promise only for a nested list or a failed binding: +34 B gzip. Dropped for size; with change 1 only select runs many rows, and change 2 already removed the walk there.
5. Remove runs of rows with one `Range.deleteContents`: happy-dom left row markers behind in the `cloned` and `block-kinds` differential subjects. Dropped.

Mutation checks: forcing `items = true` fails 5 differential subjects and all 5 new kept-row tests; `parentNode` instead of `isConnected` fails the branch test.

## Loader size (todo example, node `zlib.gzipSync` level 9 of the built loader, clean `dist`)

| Step                                                                                      | Bytes |
| ----------------------------------------------------------------------------------------- | ----: |
| base                                                                                      |  4044 |
| changes 1 (set per binding), 2, 3, 4                                                      |  4284 |
| one walk instead of walk + array + findNodes                                              |  4250 |
| async `patchRow` again (drop change 4)                                                    |  4216 |
| one flag per list instead of a set per binding                                            |  4188 |
| `readRows` in one loop, no row marker check, no `list.path === undefined` test, `.at(-1)` |  4136 |
| `patchList` with plain parameters                                                         |  4129 |
| `reads.get(name)!` instead of a `''` fallback                                             |  4117 |
| node map on the start marker instead of a `WeakMap`                                       |  4110 |
| `removeRange` and `moveRange` inlined                                                     |  4101 |
| diff: list path from `segments.slice(0, at)` instead of a prefix argument                 |  4082 |

Measured costs over the final code: node cache about 52 B, `items` about 90 B, row hook count about 13 B. The rows build's loader is the same code: 4044 to 4082 B.

## A/B

`node benchmarks/harness/rows-ab.mjs --dir base=.ab/base --dir branch=.ab/branch --runs 21 --ops select,swap,remove,update10th,clear,append1k`, minified builds of base de80d0b and branch 084f381. N = 21 fixed before each run. Each run waited for the 1-minute load under 3 (checked every 2 minutes).

Run 1, `--metric paint` (default), load 3.14 3.94 4.06 at the start (started after the check read 2.98), 4.61 4.26 4.13 at the end:

| Op          | base       | branch     | Change | Noise | Verdict      |
| ----------- | ---------- | ---------- | -----: | ----: | ------------ |
| select      | 15.5 (0.1) | 15.5 (0.3) |  +0.2% |   0.9 | within noise |
| swap        | 15.8 (0.1) | 15.9 (0.2) |  +0.4% |   0.7 | within noise |
| remove      | 15.5 (0.1) | 15.6 (0.3) |  +0.4% |   0.9 | within noise |
| update 10th | 15.9 (0.2) | 16.1 (0.2) |  +0.7% |   0.7 | within noise |
| clear       | 15.0 (0.2) | 15.1 (0.2) |  +0.4% |   0.6 | within noise |
| append      | 57.0 (0.7) | 57.9 (1.2) |  +1.5% |   3.6 | within noise |

Every small operation lands at 15 to 16 ms on both sides with a MAD of 0.1 to 0.3: click to paint waits for the next frame, so it cannot show a change of a few ms of main-thread work. This was seen after the run, so run 2 is a second experiment, reported in full, not a replacement.

Run 2, `--metric cpu` (main-thread task time from the click to the paint), load 2.85 3.63 3.88 at the start, 4.32 4.26 4.16 at the end:

| Op          | base       | branch     | Change | Noise | Verdict      |
| ----------- | ---------- | ---------- | -----: | ----: | ------------ |
| select      | 3.4 (0.1)  | 1.9 (0.1)  | -44.4% |   0.3 | real         |
| swap        | 10.3 (0.8) | 6.8 (0.5)  | -34.6% |   2.4 | real         |
| remove      | 10.4 (0.8) | 6.2 (0.2)  | -40.7% |   2.3 | real         |
| update 10th | 12.4 (0.8) | 10.2 (0.8) | -17.9% |   2.5 | within noise |
| clear       | 4.4 (0.2)  | 3.4 (0.2)  | -21.4% |   0.7 | real         |
| append      | 41.2 (1.8) | 37.8 (0.9) |  -8.1% |   5.4 | within noise |

## Profile on the branch (load 4.3 to 5.5, so read the totals loosely)

| Op          | List/patch | Top entries                                                                            |
| ----------- | ---------: | -------------------------------------------------------------------------------------- |
| select      |        1.0 | `patchList` 0.63, `readRows` 0.22, `patchRow` 0.14                                     |
| swap        |        1.1 | `patchList` 0.35, `checkKeyed` 0.34, `readRows` 0.30, `getStayers` 0.11                |
| remove      |        1.1 | `patchList` 0.38, `checkKeyed` 0.32, `readRows` 0.28, `getStayers` 0.10                |
| update 10th |        1.6 | `patchList` 0.44, `checkKeyed` 0.28, `setText$` 0.23, `checkChanged` 0.20              |
| clear       |        4.9 | native `remove` 3.71, `patchList` 0.67, `readRows` 0.33, `checkKeyed` 0.18             |
| append      |       10.0 | `importNode` 1.93, `patchList` 1.67, `setAttribute` 1.64, `before` 1.47, `clone$` 1.18 |

`walk`, `findNodes` and `collectBlocks` are gone from every profile. What remains on update every 10th and append is the pairing and diff over all 1,000 items (`patchList`, `checkKeyed`, `readRows`, `getStayers`), the 100 changed rows, and for append the clone of 1,000 new rows.

## Checks

- `pnpm --filter idlip build && pnpm --filter idlip test`: 821 passed, 29 skipped.
- `npx tsc --noEmit` in `packages/idlip`: no errors.
- `pnpm --filter website build && pnpm --filter website test`: 135 passed.
- e2e with the four ports: 27 passed, the loader budget test included.
- Benchmark builds (`pnpm build`, `build:rows`, `build:dashboard`, `build:scale` in `benchmarks/idlip`), harness tests 16 passed.
- `rtk proxy pnpm lint`: exit 0. `pnpm exec oxfmt --check .`: clean.

## Review round (2026-11-23), rebased on `batch/core` 7ad4079

### The skip of kept rows was wrong, and is removed

Writing the tests the review asked for (a keyed path and a key-callback list) found a counterexample. The manifest gives the same paths for a row's own item and for other items of the same list:

| Hole in the row                              | Field key paths                       | Computed key paths                      |
| -------------------------------------------- | ------------------------------------- | --------------------------------------- |
| `r.label`                                    | `rows.*.label`                        | `rows.*.label`                          |
| `rows[first]?.label`                         | `rows.*.label`, `first`               | same                                    |
| `rows.find((x) => x.label === r.label)?.id`  | `rows.*.id`, `rows.*.label`           | same                                    |
| `rows.find((x) => x.id === selected)?.label` | `rows[id=selected].label`, `selected` | `rows.*.id`, `rows.*.label`, `selected` |

After a swap, `rows[first]` changes in rows whose own item is the same reference, and the skip left them stale ("rows that read other items of their list" in `kept-rows.test.ts` fails with the skip, passes without). The computed-key `find` failed the same way after a rename. No client rule can tell the reads apart, so the skip is gone and `contracts/compiled-format-perf-list-kept.change-request.md` now asks for a compiler mark on groups that read only their own item.

### Other review fixes

- Node cache: a row is walked again only when a block was added since its last walk (`addCount` in `blocks.ts`, bumped by `addBlock`; every `setBranch$` and region swap calls it). A binding absent from an inactive branch no longer walks the row on every lookup. Test "walks a row once while no block is added" counts `i-a` reads (0 over two renames); it fails with a re-walk on a missing name and with no re-walk after a swap. The `isConnected` check is gone: the hand-written swap in `list.test.ts` now calls `addBlock` as `setBranch$` does.
- `onBlock` keeps its public two-argument form. `forgetNodes` registers with the internal `onPageBlock`, which does not count as a row hook.
- `readRows`: the depth counter is updated outside the conditions, and a stray `/i` at depth 0 is skipped.
- Loader: 3991 B with the skip removed (base 4044 B); the cuts from the first round stay.

### A/B, three sides

`rows-ab.mjs --dir base=… --dir cache=… --dir sync=… --runs 21 --metric cpu`, N fixed before the run, waited for the 1-minute load under 3 (8.27, 4.11, then 2.68). Load 2.68 5.02 5.28 at the start, 4.15 4.01 4.53 at the end. `cache` is the final code (node cache, block-count check, row hook count, no skip); `sync` adds a synchronous `patchRow` with the scope before the patch made only for nested lists (+38 B, loader 4029 B).

| Op          | base       | cache      | Change | Noise | Verdict      | sync       | Change | Noise | Verdict      |
| ----------- | ---------- | ---------- | -----: | ----: | ------------ | ---------- | -----: | ----: | ------------ |
| select      | 3.5 (0.0)  | 1.9 (0.1)  | -46.9% |   0.3 | real         | 1.6 (0.1)  | -52.8% |   0.2 | real         |
| swap        | 10.2 (1.2) | 8.7 (0.8)  | -14.5% |   3.6 | within noise | 9.7 (1.3)  |  -4.5% |   3.8 | within noise |
| remove      | 9.7 (0.3)  | 7.9 (0.4)  | -19.1% |   1.1 | real         | 7.3 (0.2)  | -24.9% |   0.9 | real         |
| update 10th | 14.0 (0.4) | 11.9 (0.9) | -15.0% |   2.6 | within noise | 13.0 (0.4) |  -7.5% |   1.2 | within noise |
| clear       | 4.9 (0.6)  | 3.9 (0.2)  | -20.6% |   1.9 | within noise | 3.8 (0.1)  | -22.1% |   1.9 | within noise |
| append      | 41.9 (0.8) | 42.8 (1.3) |  +2.1% |   3.8 | within noise | 41.5 (1.4) |  -0.9% |   4.1 | within noise |

`sync` and `cache` differ by less than the noise on every operation (select 1.6 against 1.9, noise 0.3), so the smaller and simpler `cache` is kept. Clear was real in the first round's run (-21.4%, noise 0.7) and is within noise here (base MAD 0.6).
