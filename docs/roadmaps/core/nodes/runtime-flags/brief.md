---
id: runtime-flags
title: Runtime feature flags that drop unused loader code
status: todo
priority: should
type: feature
story:
early: false
outline: false
milestone: apps
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter idlip exec vitest run test/vite test/client
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - packages/idlip/src/client/features.ts
  - packages/idlip/src/vite/features.ts
  - packages/idlip/test/vite/features.test.ts
shared:
  - packages/idlip/src/vite/plugin.ts
  - packages/idlip/src/client/loader/resume.ts
  - packages/idlip/src/client/patch/diff.ts
  - packages/idlip/src/client/tasks/**
  - packages/idlip/src/compiler/index.ts
  - e2e/tests/todo.spec.ts
reserves: []
provides: []
depends_on:
  - on: run-tasks
    kind: hard
    why: puts the task runner it adds behind a flag
  - on: keyed-paths
    kind: hard
    why: puts the keyed diff it added behind a flag
---

# Runtime feature flags that drop unused loader code

## Goal

The loader has a 4096 B gzip budget and was at 4061 B after `keyed-paths`. Several nodes still add loader code. The user chose feature flags, as brumate does: the loader reads `HAS_*` constants from `src/client/features.ts`, and the Vite plugin defines them from the features the compiled app uses, so a build drops the code of unused features. Pages that use none of the new features pay nothing for them.

## Context

- Prior art: `../brumate/packages/brumate/src/runtime/features.ts` (`declare const __BRUMATE_HAS_*__: boolean | undefined`, each flag `true` when the define is missing) and `../brumate/packages/brumate/src/vite.ts` (collects `features` while it compiles, around line 800). Read both before designing.
- The compiler result of each module says which features it uses (tasks, keyed paths, and later subscriptions, refs, nested components). The plugin unions them over the app and passes the defines to the client build. Unbundled use (tests, `idlip/testing`, dev without the plugin) keeps every flag `true`.
- The flag list is one place: `src/client/features.ts`. Later nodes (`write-sets`, `dom-refs`, `commands-subs`, `nesting-runtime`, `global-events`) add their flag there and put their loader code behind it.
- Order of the client build: the defines must be known before the loader is bundled. Check how brumate gets this order in Vite, and do the same.

## Acceptance

- [ ] `HAS_TASKS` and `HAS_KEYED` exist. The task runner from `run-tasks` and the keyed diff from `keyed-paths` sit behind them.
- [ ] A build of `examples/todo` (no tasks, no keyed paths) has a loader without that code. The e2e budget test reports the size, and it is below the size on `batch/core` before this node.
- [ ] A build of an app that uses a feature keeps its code (a test builds a fixture with an `await` handler and checks the task runner is in the loader).
- [ ] Unbundled tests still run every feature.
- [ ] `pnpm build && pnpm --filter e2e test` pass.

## Sizing

M: plugin plus loader, known pattern from brumate.
