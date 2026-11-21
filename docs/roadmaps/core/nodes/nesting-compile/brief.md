---
id: nesting-compile
title: Codegen for nested components
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
verify: pnpm --filter idlip exec vitest run test/compiler/view/codegen/nesting.test.ts test/fixtures
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - packages/idlip/src/compiler/view/codegen/child.ts
  - packages/idlip/test/compiler/view/codegen/nesting.test.ts
shared:
  - packages/idlip/src/compiler/view/codegen/plan.ts
  - packages/idlip/src/compiler/view/codegen/html.ts
  - packages/idlip/src/compiler/view/codegen/chunks.ts
  - packages/idlip/src/compiler/view/codegen/module.ts
  - packages/idlip/src/compiler/view/codegen/events.ts
  - packages/idlip/src/compiler/view/codegen/index.ts
  - packages/idlip/src/server/render.ts
reserves: []
provides: []
depends_on:
  - on: nesting-format
    kind: contract
    via: compiled-format
---

# Codegen for nested components

## Goal

Codegen for `child` nodes and prop-target events, matching the nested fixtures: server render of children, a state record with child manifests, slot models, props bindings, message props with the parent path, and child init and render chunks.

## Context

- Follow `contracts/compiled-format-nesting.change-request.md`. Output is compared with `packages/idlip/test/fixtures/nested/`.
- Today codegen reports `child` nodes as codegen-unsupported.

## Acceptance

- [ ] The nested fixture matches byte for byte; the counter and todo fixtures are unchanged.
- [ ] No `codegen-unsupported` for `child` nodes.
- [ ] Fast check passes: `pnpm --filter idlip exec vitest run test/compiler/view/codegen/nesting.test.ts test/fixtures`

## Sizing

One codegen module over a fixed fixture; shared files are touched in small places.

## From nesting-format (orchestrator)

`Step` gains an explicit `$step: true` discriminant (`contracts/compiled-format-nesting.change-request.md`). `nesting-compile` makes the compiler emit `$step` on every step and updates the goldens (including `effects`); `nesting-runtime` makes `resume.ts` `isStep` test `$step`. Read the change request, not only the contract, until the curator applies it.
