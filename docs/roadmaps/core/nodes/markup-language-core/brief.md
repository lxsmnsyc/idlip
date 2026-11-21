---
id: markup-language-core
title: Language core and tsc wrapper
status: dropped
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
spent: 145785
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

- [x] `@idlip/tsc` reports a hole type error at the `.idlip` line and column.
- [x] A clean `.idlip` file typechecks with no output.
- [x] Fast check passes: `pnpm --filter @idlip/language-core test`

## Sizing

Two small packages over an existing emitter.

Landed as 00dc806 on `feat/markup-frontend` after one clean fresh review. Accepted change outside owned paths: re-export of `toTypeScript` from `packages/idlip/src/compiler/index.ts`.

Dropped 2026-11-21 by debate `debates/dsl`: built on `feat/markup-frontend` only, never merged; the branch stays as history.
