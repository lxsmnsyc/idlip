---
id: nesting-runtime
title: Runtime for nested components
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
verify: pnpm --filter idlip exec vitest run test/client/nest
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - packages/idlip/src/client/nest/**
  - packages/idlip/test/client/nest/**
shared:
  - packages/idlip/src/client/loader/resume.ts
  - packages/idlip/src/client/patch/patch.ts
  - packages/idlip/src/client/patch/diff.ts
  - packages/idlip/src/client/index.ts
  - packages/idlip/src/core/format.ts
reserves: []
provides: []
depends_on:
  - on: runtime-flags
    kind: hard
    why: loader code goes behind a flag in src/client/features.ts, to keep the loader budget
  - on: nesting-format
    kind: contract
    via: compiled-format
---

# Runtime for nested components

## Goal

The loader resolves a message's model path, runs the child update on its slot and writes the slot back immutably, then patches the child region with the child manifest. A parent patch passes new props to the child. Client-added rows run the child init.

## Context

- Follow `contracts/compiled-format-nesting.change-request.md`.
- `resume.ts` is shared with other nodes; keep the edit small.

## Acceptance

- [ ] A child click loads only the child handler and binding chunks.
- [ ] `onRemove` runs the parent remove and drops the slot.
- [ ] A changed prop patches the child's `props.x` binding.
- [ ] The loader stays under 4096 B gzip.
- [ ] Fast check passes: `pnpm --filter idlip exec vitest run test/client/nest`

## Sizing

Loader, patch and diff changes plus a new client module.

## Updates after wave 7

- Put the loader code behind a `HAS_<NAME>` flag (`HAS_NESTING`), following the recipe in `nodes/runtime-flags/outcome.md`: a `declare const` and export in `src/client/features.ts`, one line in `DETECTORS` of `src/vite/features.ts`, and `if (HAS_NESTING)` around the code. The 4096 B gzip budget is the loader with no optional features, so the flag removes your cost from apps that do not use it. Report the feature's cost; it is not capped. The detector is on when a manifest has a child entry (see the nesting change request once accepted).
- `resume.ts` now has `runTask(host, task)` in `apply` and a `HAS_TASKS` gate. Keep nesting's slot logic outside `apply` where possible.

## From nesting-format (orchestrator)

`Step` gains an explicit `$step: true` discriminant (`contracts/compiled-format-nesting.change-request.md`). `nesting-compile` makes the compiler emit `$step` on every step and updates the goldens (including `effects`); `nesting-runtime` makes `resume.ts` `isStep` test `$step`. Read the change request, not only the contract, until the curator applies it.
