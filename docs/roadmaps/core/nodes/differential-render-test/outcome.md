# Outcome: differential-render-test

## Built

- `packages/idlip/test/differential/`: `differential.test.ts`, `harness.ts` (open a subject, render a model on the server, patch the DOM between two models through the chunks), `states.ts` (seeded model generator), `subjects.ts` (the components), `divergences.ts` (accepted list), `subjects/rich.tsx`, `subjects/parent.tsx`, `subjects/counter.tsx`.
- `packages/idlip/src/testing/index.ts`: `mount` takes `children`, a source per import specifier. `modules.ts` holds the child server modules in the scope.
- Two checks per subject:
  - Model pairs: server render of A, patch to B through `createPatch` (binding chunks for branches, list chunks for rows), compare with the server render of B. 40 seeds, 3 pairs each, plus hand-made pairs.
  - Handlers: `mount` with the server-render check, clicking every handler element twice over (for a parent, the elements that change the root model).
- Subjects (14): counter, todo, form, refs, dynamic, pick, svg, raw, svg-try, try-board, example todo, rich (conditions with and without else, a condition and a list inside a row, a list in a list, raw HTML, SVG, `<Try>`), and three with children (nested board, example counters board, a parent whose children come and go in a list and a condition).
- 1440 model pairs and 86 click steps per run. The file runs in about 1 s, the whole suite in about 22 s.

## Proof

- Changing `setBranch$` to write a wrong branch number fails the test (8 failures). Changing the label that `addChild` renders fails the parent subject.
- `pnpm --filter idlip build && pnpm --filter idlip test`: 61 files, 701 passed, 3 skipped (model pairs of the three subjects with children).
- `pnpm lint` and `pnpm exec oxfmt --check .`: clean for the new files.

## Accepted divergences

Each entry fails the test when no run produces it any more.

- `caught-region-stays` (try-board): a `<Try>` region that caught stays on its catch view until `reset` (proposal 0004, "a catch view is not patched"). A kept row whose model recovers keeps the catch view, while a server render of the new model shows the body. By design.
- `input-value-newline` (todo, example-todo, rich): the `value` setter of an input drops line breaks, and happy-dom reads the raw attribute of a server-rendered input. A test environment difference, a browser sanitizes both.

## Bugs found

- None in the render path. Both divergences are by design or from the test environment.
- Harness bug, fixed (`feat(testing)` commit): the `mount` check rendered the server page from the model of the last patched page, which was a child's after a child patch, so any parent with a child failed with `items is not iterable`.

## Deviations

- `src/testing/index.ts` and `modules.ts` changed (shared path) for the `children` option. The public `idlip/testing` API grew by one option. No changeset: the repo has none yet.
- The `effects` fixture is not a subject: it imports `./api.ts` and `mount` takes one source.
- Subjects with children do not run the model-pair check. A child patch needs the loader's nesting state, so they run through handlers. The check renders a child from its initial model, so a click on a child's own button is left out for them.
- The comparison stops at the first difference of a pair, so an accepted divergence hides later differences in the same pair.

## Stubs left

- None.

## Gotchas

- A new generator draw changes the states of later seeds. A divergence that depended on a lucky seed (`caught-region-stays` in rich) disappeared once the draws changed. Give a divergence a hand-made pair in `subjects.ts` (`pairs`) when it must stay covered.
- `cloned-templates` adds a second client render output. Add its subjects here before it lands: nothing else compares its rows with the server.

## Proposed learnings

- A render change runs `pnpm --filter idlip test differential` first | the test names the first node where the page differs from the server render | packages/idlip/test/differential | yes

## Verification

- `pnpm --filter idlip build && pnpm --filter idlip test`: passed.
- `pnpm exec tsc --noEmit` in `packages/idlip`: one error, in `test/vite/features.test.ts` (unused `idlip` import), present before this node.
