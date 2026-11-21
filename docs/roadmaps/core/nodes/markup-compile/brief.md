---
id: markup-compile
title: Compile .idlip files
status: todo
priority: should
type: feature
story: markup-frontend
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
verify: pnpm --filter idlip exec vitest run test/compiler/markup/compile
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - packages/idlip/src/compiler/markup/compile.ts
  - packages/idlip/test/compiler/markup/compile/**
shared:
  - packages/idlip/src/compiler/index.ts
  - packages/idlip/src/vite/plugin.ts
reserves: []
provides: []
depends_on:
  - on: markup-lower
    kind: hard
    why: needs the real lowering and mappings
---

# Compile .idlip files

## Goal

Feed `.idlip` files into `compile()`, map diagnostics back to `.idlip` spans, resolve `.idlip` imports in `readImport` and include them in the Vite plugin filter.

## Context

- Shared: `packages/idlip/src/compiler/index.ts`, `packages/idlip/src/vite/plugin.ts`.

## Acceptance

- [ ] A `.idlip` todo compiles to the same chunks as its TSX twin.
- [ ] A hole type error or analyzer error points at the `.idlip` line.
- [ ] A `.idlip` file imported from another `.idlip` or `.tsx` file resolves.
- [ ] Fast check passes: `pnpm --filter idlip exec vitest run test/compiler/markup/compile`

## Sizing

Wiring plus span mapping over existing stages.
