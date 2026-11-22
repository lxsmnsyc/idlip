# Outcome: perf-list-kept

## Built

- `client/patch/patch.ts`: `getPlan` keeps the paths each binding reads (`reads`, from `manifest.groups`). For each list it patches, `patch()` sets `items` on the context (`RowContext`, exported with `PatchRows`): true when every chosen row binding changed only through paths under `<list path>.*`. An index read gives the list path, so it counts as outside. `selectGroups` takes the changed paths instead of computing them.
- `client/list/index.ts`: a kept row whose item is the same reference runs no binding when `items` is true. Each row keeps its node map on its start marker (`rowNodes`) and is walked again only when a cached node is not `isConnected`. One recursive walk (`indexNode`) builds the map, without the node array. `readRows` is one loop. Removed rows are walked for blocks only when `rowHooks > 0`. The `A row has no markers` check is gone: the compiler's clones start and end with the markers.
- `client/patch/blocks.ts`: `onBlock(add, remove, outside?: true)` and `rowHooks`. `client/patch/nodes.ts` registers `forgetNodes` with `true`.
- `client/patch/diff.ts`: the list path at a `*` is `segments.slice(0, at).join('.')`, no prefix argument (a loader byte cut).
- `benchmarks/harness/profile-rows.mjs`: profiles any rows operation after its own warmup (commit f7d0207).
- Tests: `test/client/list/kept-rows.test.ts` (select, index after remove, swap, nested list whose outer item changed, a branch rendered again after the nodes were cached). The differential subjects already keep 30% of rows as the same reference, so they run the skip path too.
- Change request: `contracts/compiled-format-perf-list-kept.change-request.md` (the v9 rule "a chosen row binding runs on every kept row").
- `client/CLAUDE.md`: two rules (kept rows and `isConnected`, `onBlock(..., true)`).

Commits on `node/perf-list-kept`: f7d0207 (harness), 084f381 (the change), plus the docs commit.

## Proof

Rows A/B, `rows-ab.mjs --runs 21` (N fixed before each run), minified builds of base de80d0b and branch 084f381, median (MAD) in ms, noise = 3 x the larger MAD. Both runs started when the 1-minute load was under 3 or right at it.

`--metric cpu` (main-thread work from the click to the paint), load 2.85 at the start, 4.32 at the end:

| Op          | base       | branch     | Change | Noise | Verdict      |
| ----------- | ---------- | ---------- | -----: | ----: | ------------ |
| select      | 3.4 (0.1)  | 1.9 (0.1)  | -44.4% |   0.3 | real         |
| swap        | 10.3 (0.8) | 6.8 (0.5)  | -34.6% |   2.4 | real         |
| remove      | 10.4 (0.8) | 6.2 (0.2)  | -40.7% |   2.3 | real         |
| update 10th | 12.4 (0.8) | 10.2 (0.8) | -17.9% |   2.5 | within noise |
| clear       | 4.4 (0.2)  | 3.4 (0.2)  | -21.4% |   0.7 | real         |
| append      | 41.2 (1.8) | 37.8 (0.9) |  -8.1% |   5.4 | within noise |

The first run used the default `--metric paint` (load 3.14 at the start, 4.61 at the end): every operation within noise, select to clear at 15 to 16 ms on both sides with a MAD of 0.1 to 0.3, append 57.0 to 57.9 ms. Click to paint waits for the next frame, so it hides a few ms of script. Both runs are in `log.md`.

Profile of the list and patch code, ms a round (`profile-rows.mjs idlip <op> 10`, unminified; base load 2.3 to 3.2, branch 4.3 to 5.5): select 4.9 to 1.0, swap 7.5 to 1.1, remove 6.5 to 1.1, update every 10th 6.7 to 1.6, clear 6.6 to 4.9 (3.5 to 3.7 of it native `remove`), append 14.0 to 10.0. `walk`, `findNodes` and `collectBlocks` are gone from every profile.

## Deviations

- Update every 10th is not faster beyond noise (-17.9%, 2.2 ms against 2.5 ms noise). The profile left of it is the pairing and diff over all 1,000 items plus the 100 changed rows.
- The `paint` metric run is reported as well; the verdict uses the `cpu` run, chosen after the first run showed the frame floor.
- Edited `client/patch/nodes.ts` (one argument to `onBlock`), which is outside the owned paths. `core/format.ts` did not change; `RowContext` extends `ListContext` in `patch.ts`.
- Read `nodes/perf-list-create/log.md` while looking for the loader size method, against the roadmap rule of reading only outcomes.
- Brumate's lessons checked against the code: a longest increasing subsequence for moves was already there (`getStayers`); freshly rendered rows already skip the binding pass; no loader rescan after insert already holds (cloned rows are not walked).
- Not done: a synchronous `patchRow` (+34 B gzip; with the skip only select runs many rows, and its walk is gone) and removing runs of rows with `Range.deleteContents` (happy-dom left markers behind in two differential subjects).

## Gotchas

- `parentNode` is not a check for a cached node: a node inside a swapped-out branch keeps its parent. Use `isConnected`.
- A group's `paths` are each of its bindings' path set, and every exported binding is in a group's `bindings`; `patch.ts` relies on both (`reads.get(name)!`).
- In select and remove profiles, 14 to 17 ms of `matches` and `parentElementOrShadowHost` is Playwright resolving the click selector.
- `rows-ab.mjs --metric paint` floors at a frame for operations under about 15 ms; compare those with `--metric cpu`.

## Verification

- `pnpm --filter idlip test`: 821 passed. `tsc --noEmit`: clean. Website build and 135 tests pass. e2e: 27 passed, loader budget included. Benchmark builds and 16 harness tests pass. `pnpm lint` exit 0, `oxfmt --check` clean.
- Mutation checks: forcing `items = true` fails 5 differential subjects and the 5 kept-row tests; `parentNode` instead of `isConnected` fails the branch test.

## Size

- Todo loader, node gzip -9 of the built file from a clean `dist`: 4044 B to 4082 B (+38 B, budget 4096 B). The rows loader is the same: 4044 to 4082 B. The feature code costs about 155 B (node cache 52, `items` 90, row hook count 13); about 117 B came back from cuts in the list and diff code (steps in `log.md`).
- Estimated M, actual M.
