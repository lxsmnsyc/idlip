---
id: nesting-format
title: Compiled format for nested components
status: todo
priority: should
type: contract
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
verify: pnpm --filter idlip exec vitest run test/fixtures
exclusive: []
fulfilled_by:
gate: true
added: 2026-11-21
spent:
owns:
  - packages/idlip/test/fixtures/nested/**
  - docs/roadmaps/core/contracts/compiled-format-nesting.change-request.md
shared:
  - packages/idlip/test/fixtures/fixtures.test.ts
  - packages/idlip/test/fixtures/reference.ts
reserves: []
provides: []
depends_on:
  - on: compiled-format
    kind: contract
    via: compiled-format
  - on: spike-view-analysis
    kind: contract
    via: view-ir
---

# Compiled format for nested components

## Goal

Define the Reserved nested-components item of `compiled-format` and add golden fixtures for a parent with a keyed `<For>` of stateful `Counter` children and an `onRemove` message prop. Write a change request that the implementing nodes follow.

## Context

- Change request `contracts/compiled-format-nesting.change-request.md` covers: where slot models live (one serializable value); a boundary marker with the model path; the queued message path, resolved in the loader from the target (the listener has 50 B headroom); child manifests and chunks in `PageState`; props binding and props paths in `diffPaths`; client init and render for a client-added child; server rendering of children under one `context.state`.
- Plain functions, no markers (`docs/proposals/0002-modules.md`, Props and nesting).
- Decisions: a child's model slot is dropped when its block is removed and restarts from props on re-add. `key` on stateful children is optional; position is the default. Confirm the slot rule at the gate.
- Analysis already emits child nodes (slots, key checks, inlined stateless components).

## Acceptance

- [ ] The nested fixtures pass the existing fixture checks.
- [ ] The change request names each section it changes: Interface, DOM encoding, State script, Manifest, Server module, Patching, Reserved.
- [ ] The user confirms the slot-removal rule at the gate.
- [ ] Fast check passes: `pnpm --filter idlip exec vitest run test/fixtures`

## Sizing

Format design plus fixtures; no runtime code. Gate because every later nesting node follows it.
