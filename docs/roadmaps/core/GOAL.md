---
milestones: [todo-resumes, apps, '0.1', components]
run: parallel
review: auto
merge:
  mode: auto
land:
  mode: batch
branches:
budget:
release:
  publish: changesets
  paths: [packages/**]
  fence: merge
---

# idlip core

## Outcome

A todo app written in the idlip DSL renders on the server and resumes in the browser. The first click loads one update handler chunk plus only the binding chunks whose model paths changed. No view code runs on load.

## Acceptance

- `pnpm --filter e2e test` passes against `examples/todo`.
- The e2e test counts network requests: the first click on a todo checkbox loads the `toggle` chunk and the binding chunks for `todos.*.done`, and nothing else.
- `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test` pass.

## Priorities

- must: needed for the `todo-resumes` milestone, the todo app resuming end to end.
- should: needed before the `0.1` release (nesting, effects, docs, benchmarks), or in the `components` milestone after it (function components).
- could: worth doing when agents are free (devtools).
- later: parked.

## Constraints

- MVU concept, not Elm's API. Names follow TypeScript conventions.
- Nothing the client resumes is a closure. Models, messages, commands and subscriptions are plain data.
- Serialization uses seroval.
- Build integration is a Vite plugin (`idlip/vite`). The compiler uses `oxc-parser`.
- One published package, `idlip`, with subpaths: `idlip`, `idlip/server`, `idlip/client`, `idlip/compiler`, `idlip/vite`, `idlip/jsx-runtime`.
- Code follows the ts-style skill. Prose follows the plain-writing skill.

## Non-goals

- Hydration fallback.
- A standalone CLI build.
- Streaming SSR, routing and data loading in this roadmap.
- npm trusted publishing before the `0.1` release.

## Verification

- Fast check (safe to run in parallel worktrees): `pnpm --filter idlip test`
- Full check (at checkpoints): `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm --filter e2e test` (under 2 minutes, no shared resources)

## Numbered resources

- Proposals: `docs/proposals/NNNN-*.md`. Nodes that add one reserve the number with `reserves: [proposal NNNN]`.

## Sources

- `docs/proposals/0001-dsl.md`
- `docs/proposals/0002-modules.md` (replaces the Messages, Update and Nesting sections of 0001)

## Open questions

- None open. The file convention is `*.idlip.tsx` with one default export (`docs/proposals/0002-modules.md`).

## Gates

- After the contract wave (`core-api`, `compiled-format`, `spike-view-analysis`): the user reviews the frozen contracts.
- After `example-todo`: the user reviews the milestone.
