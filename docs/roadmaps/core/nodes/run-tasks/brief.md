---
id: run-tasks
title: Run tasks and dispatch continuations in the loader
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
verify: pnpm --filter idlip exec vitest run test/client/tasks test/client/loader
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - packages/idlip/src/client/tasks/**
  - packages/idlip/test/client/tasks/**
shared:
  - packages/idlip/src/client/loader/resume.ts
  - packages/idlip/src/client/index.ts
  - packages/idlip/src/core/format.ts
reserves: []
provides: []
depends_on:
  - on: custom-effects
    kind: behavior
    via: compiled-format
  - on: resume-loader
    kind: hard
    why: replaces the "tasks are not supported" stub in resume.ts
---

# Run tasks and dispatch continuations

## Goal

`runTask(task, dispatch)` loads `manifest.tasks[site]`, calls its export, and dispatches `{ t: task.then, p: [outcome, ...task.carried] }` to the same root. A task's continuation joins the queue as an event without a DOM target. Built-in sites settle within the batch before the patch, so `add` patches once. Other tasks dispatch later, and every run continues (no latest-wins).

## Context

- Build against the task-chunk change request from `custom-effects` (`contracts/compiled-format-tasks.change-request.md`), using hand-written chunks.
- Budget: the loader has about 195 B gzip left. The built-in code lives in handler chunks, not in the loader.
- `Random` and `Time` are exported from `idlip` by `stock-sources`, not here.

## Acceptance

- [ ] A task resolves and the continuation runs with `{ ok: true, value }`. A rejection gives `{ ok: false, error }`. A failed task chunk is reported and keeps the model.
- [ ] `Random.id` in a step patches once, after the continuation.
- [ ] Two clicks give two independent continuations.
- [ ] Loader size is at most 4096 B gzip.

## Sizing

M: loader queue changes in a tight budget.
