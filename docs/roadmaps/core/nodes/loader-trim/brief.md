---
id: loader-trim
title: Trim the flag-off seams out of the loader
status: done
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
size: S
spike: false
hypothesis:
verify: pnpm --filter idlip test && pnpm build && pnpm --filter e2e test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent: 149933
owns:
  - packages/idlip/src/client/**
  - packages/idlip/src/vite/features.ts
  - packages/idlip/test/client/**
  - packages/idlip/test/vite/features.test.ts
shared:
  - e2e/tests/todo.spec.ts
reserves: []
provides: []
depends_on:
---

# Trim the flag-off seams out of the loader

## Goal

The todo loader is 4007 B gzip of 4096 B with every optional feature off. Each landed flag left 20 to 100 B of seams behind (`nest!`, the `Seams` defaults in `resume.ts`, `isStep`, the `owner` field in `listener.ts`, the plan code for `props.*` paths, and similar). Reclaim them so the todo loader is under 3900 B and the nodes after this one have room for their own seams.

## Context

- Source: `reviews/wave-7.md` (Learned) and `nodes/runtime-flags/outcome.md` (Proof). The nodes that landed flags report their seam cost: `nesting-runtime` 97 B, `dom-refs` 24 B, `write-sets` 22 B, `keyed-paths` and `run-tasks` smaller.
- Measure the way the e2e budget test does: `gzipSync(level 9)` of the loader and its static imports in the `examples/todo` production build. Keep a before and after table by seam in `outcome.md`.
- Behavior must not change. Every flag still has its recipe in `src/client/CLAUDE.md`.

## Acceptance

- [x] The todo build loader is at most 3900 B gzip -9 (the e2e budget test, with `loaderBudget` lowered to 3900).
- [x] With every flag on (no plugin), `pnpm --filter idlip test` is unchanged and green.
- [x] `outcome.md` lists each seam removed and its bytes, and the cost of each flag when on.
- [x] Change request: none, unless a seam lives in the format. Then write `contracts/compiled-format-loader-trim.change-request.md`.

## Sizing

One pass over `resume.ts`, `listener.ts`, `patch/*` and `nesting.ts`, driven by byte measurements.

## Notes for the worker

- Prefer folding a branch behind its flag (`if (HAS_X)` around the whole block, with values moved inside) over restructuring. Do not add a flag combination: one flag per feature.
- Do not trade away the pairing of `*` items by key; `runtime-flags/outcome.md` says it stays on.
- The listener script has its own 1024 B budget; check it too.

Landed as 3584fdf on `batch/core` after a fresh review (no behavior change). Todo loader 4007 B to 3881 B. The e2e budget stays at the contract value, 4096 B (the worker had lowered it to 3900; the orchestrator reverted that).
