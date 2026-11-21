---
id: dom-refs
title: Refs and Dom functions
status: active
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
verify: pnpm --filter idlip exec vitest run test/client/dom test/compiler test/testing test/fixtures
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-20
spent:
owns:
  - packages/idlip/src/client/dom/**
  - packages/idlip/src/core/dom.ts
  - packages/idlip/test/client/dom/**
  - packages/idlip/test/testing/effects.test.ts
shared:
  - packages/idlip/src/compiler/view/codegen/plan.ts
  - packages/idlip/src/compiler/view/codegen/html.ts
  - packages/idlip/src/compiler/view/codegen/chunks.ts
  - packages/idlip/src/compiler/view/analyze/analyze.ts
  - packages/idlip/src/compiler/update/segments.ts
  - packages/idlip/src/compiler/update/emit.ts
  - packages/idlip/src/client/loader/resume.ts
  - packages/idlip/src/core/format.ts
  - packages/idlip/src/index.ts
  - packages/idlip/test/fixtures/**
reserves: []
provides: []
depends_on:
  - on: runtime-flags
    kind: hard
    why: loader code goes behind a flag in src/client/features.ts, to keep the loader budget
  - on: custom-effects
    kind: hard
    why: Dom.measure is a built-in site in the segment compiler
  - on: run-tasks
    kind: hard
    why: after-patch calls run in the task runner it adds to resume.ts
  - on: patch-lists
    kind: contract
    via: compiled-format
---

# Refs and Dom functions

## Goal

`ref="search"` renders `i-ref="search"`. `ref={['row', t.id]}` renders `i-ref="row a1"` in rows. The tuple key must be the `<For>` key path (new rule `ref-key`), so the attribute never patches. `Dom.focus`, `Dom.scrollIntoView` and `Dom.reset` called in a handler compile to after-patch calls. They run once after the batch's patch, so an element added by that patch is found. `await Dom.measure(ref)` is a built-in site returning a plain `{ x, y, width, height }` object. Names are looked up under `Page.root`; nesting adds component scope later.

## Context

- Decided by the orchestrator in the one-shot run (the user can revisit): plain `Dom.focus()` calls are deferred until after the patch, not awaited. `measure` returns a plain rect, because a `DOMRect` does not serialize into the message log.
- Change requests: compiled-format, Reserved to DOM encoding (the `i-ref` value) and `Step.after: readonly Task[]`; core-api, `measure` returns a plain rect; view-ir, `ref-key`.
- Also add a `mount` test of the 0002 `add` with `await Random.id()` (the first end-to-end test of `custom-effects` with `run-tasks`).

## Acceptance

- [ ] Server and item-template output carry `i-ref`. The fixtures cover a row ref.
- [ ] Focus on an element the same message renders works. A missing ref warns and does nothing.
- [ ] `await Dom.measure` gives the rect to the continuation.
- [ ] Loader size is at most 4096 B gzip.

## Sizing

M: codegen, handler rewrite and runtime, each small; context load is medium.

## Updates after wave 7

- `Dom.measure` is a built-in site. `compiled-format` v10 lists a built-in in `manifest.tasks` with the value `handler=<name>`, and the handler chunk exports `task$<site>(...args)`. The loader runs it in the current batch through `runTask(host, task)` (`src/client/tasks/run.ts`), so one patch covers the step and its continuation. Add the site to `emitBuiltinTask` in `src/compiler/update/tasks.ts`. `Step.after` is a new field: read how `apply` in `resume.ts` runs a step first.
- Loader size: the budget is the loader with no optional features. Put the loader code behind a `HAS_<NAME>` flag (`HAS_REFS`), following the recipe in `nodes/runtime-flags/outcome.md`: a `declare const` and export in `src/client/features.ts`, one line in `DETECTORS` of `src/vite/features.ts`, and `if (HAS_REFS)` around the code. The 4096 B gzip budget is the loader with no optional features, so the flag removes your cost from apps that do not use it. Report the feature's cost; it is not capped. The detector is on when a handler has an after-patch `Dom` call or a view has `i-ref`.
- The `mount` test with `await Random.id()` can reuse `test/client/tasks/tasks.test.ts` and `test/compiler/update/effects.test.ts` as models. `Random` and `Time` are exported from `idlip` now.
