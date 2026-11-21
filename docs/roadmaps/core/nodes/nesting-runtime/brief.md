---
id: nesting-runtime
title: Runtime for nested components
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
