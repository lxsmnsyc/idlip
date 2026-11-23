# Outcome: differential-children

## Built

- `packages/idlip/src/testing/index.ts`: `MountedPage.children()` and `patchChild(path, model)`, and the `MountedChild` type.
- `differential.test.ts`: a child walk for each subject with children (nested board, example board, board with subscriptions, parent, widgets). 40 generated models per child, each patched through the child's chunks and compared with a server render from the slot models.
- Handler run: the `clicks` option is gone. Every `on:click` is clicked, child buttons included, for all subjects.

## Proof

- Dropping the slot record in `patchChild` fails the child walk of 4 subjects.
- `pnpm --filter idlip build && pnpm --filter idlip test`: 64 files, 740 passed, 17 skipped. The differential file runs in about 1.6 s, the whole suite in about 8 s.
- `pnpm lint`: no finding in the touched files. `pnpm exec oxfmt --check .`: clean for them.

## Bugs found

- None. Child patches and child clicks match the server render.

## Deviations

- Root model pairs of subjects with children stay skipped. `open` renders no child, and a root patch needs the nesting state (`addChild`, `setProp`) of the loader. Their root models change through handler clicks only.
- `patchChild` runs beside the loader. Its models are not the loader's, so a test must not click after it. Not documented in `website/docs/testing.md` (outside the owned paths).
- Child models are small (a counter holds one number), so the walk is a thin check of the child's own render.

## Stubs left

- None.

## Proposed learnings

- None.

## Verification

- The build and test command above passed.
