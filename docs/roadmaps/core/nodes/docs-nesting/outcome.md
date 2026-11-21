# Outcome: docs-nesting

## Built

- `website/docs/nesting.md`, "Nesting components", section Guide, `order: 20`. It sorts after `resuming` (12), so after `views` (11), and leaves 13 to 19 and 21 to 29 free.
- Sections: a child component, the parent, props are data, messages from a child, slots, what the browser loads, limits.
- Samples: `examples/counters/src/counter.idlip.tsx` and `board.idlip.tsx` without the header and lint comments, both `tsx` (compiled by the checker). The HTML and the slots table come from a render of the built `examples/counters` server entry. The request table comes from `e2e/tests/nested.spec.ts`.
- Limits stated on the page:
  - A child handler cannot call a callback prop (`handler-props-unlisted`).
  - A dynamic hole in a child binds with its static paths.
  - A child's model is dropped when its block is removed.
  - A hot remount keeps only the child's model.
  - A child is found only through an idlip module that renders it.
  - A child with no `key` outside a loop is slotted by position.
  - Children cost about 650 B of loader.

## Deviations

- None. No files outside `website/docs/nesting.md` and `nodes/docs-nesting/`.

## Stubs left

- None.

## Gotchas

- The `Step.send` limit shows as `handler-props-unlisted` with the message "finish reads the props path `` that the analysis did not list", with an empty path. It does not say that a call to a callback prop is not supported. Repro: a child with `function finish() { count = 0; props.onDone(); }` and `on:click={finish}`, compiled with `compile(src, '/sample.idlip.tsx')`. Not a runtime bug. The compiler message can improve when `Step.send` is built.
- `pnpm --filter e2e test` fails with "port 4173 already used" while another worktree runs e2e. Set `E2E_PORT`, `E2E_COUNTERS_PORT` and `E2E_SUBS_PORT`.

## Proposed learnings

- None.

## Verification

- `pnpm --filter website check:samples`: 36 samples, 0 problems.
- `pnpm --filter website build`: 20 pages written.
- `pnpm --filter website check:reference`: 94 exports, 0 problems.
- `check_prose.py website/docs/nesting.md`: ok. `oxfmt --check`: ok.
- Full check: `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` pass (659 tests). `pnpm --filter e2e test` with ports 4573 to 4575: 18 passed.

## Size

- Estimated S, actual S.
