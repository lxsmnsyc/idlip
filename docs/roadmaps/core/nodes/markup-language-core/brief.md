---
id: markup-language-core
title: Language core and tsc wrapper
status: active
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
verify: pnpm --filter @idlip/language-core test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - packages/language-core/**
  - packages/tsc/**
shared:
  - pnpm-lock.yaml
  - pnpm-workspace.yaml
reserves: []
provides: []
depends_on:
  - on: markup-lower
    kind: hard
    why: uses the real emitter and mappings
---

# Language core and tsc wrapper

## Goal

Create `packages/language-core` (`@idlip/language-core`, a Volar language plugin using `toTypeScript()`) and `packages/tsc` (`@idlip/tsc`) so `pnpm typecheck` checks `.idlip` files.

## Context

- Follow brumate: `../brumate/packages/language-core` and `tsc`.
- Touches `pnpm-lock.yaml` and the workspace. The package layout is subject to the gate decision in `markup-syntax`.

## Acceptance

- [ ] `@idlip/tsc` reports a hole type error at the `.idlip` line and column.
- [ ] A clean `.idlip` file typechecks with no output.
- [ ] Fast check passes: `pnpm --filter @idlip/language-core test`

## Sizing

Two small packages over an existing emitter.
