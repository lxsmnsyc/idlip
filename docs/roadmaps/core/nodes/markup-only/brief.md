---
id: markup-only
title: Remove TSX as a source syntax
status: dropped
priority: should
type: refactor
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
verify: pnpm build && pnpm test && pnpm --filter e2e test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - packages/idlip/src/compiler/**
  - packages/idlip/src/vite/**
  - packages/idlip/src/jsx/**
  - packages/idlip/src/jsx-runtime/**
  - packages/idlip/package.json
  - packages/language-core/**
  - packages/tsc/**
  - packages/language-server/**
  - packages/vscode/**
shared:
  - docs/roadmaps/core/GOAL.md
  - docs/proposals/**
reserves: []
provides: []
depends_on:
  - on: markup-port
    kind: hard
    why: every module must be `.idlip` before the TSX input goes
---

# Remove TSX as a source syntax

## Goal

After `markup-port`, `.idlip` is the only source format. Remove the TSX input path: `compile()` and the Vite plugin accept `.idlip` only, and a `.idlip.tsx` file is a clear error that points to the DSL. The lowering to TSX may stay as an internal step of the one compiler, but it is not a user-facing syntax: drop the public `idlip/jsx-runtime` subpath and the user-facing JSX element types, or move what the type checker needs into `@idlip/language-core` as internal virtual-file types. Update `GOAL.md` Constraints (views are the markup DSL, file convention `*.idlip`), proposals 0001, 0002 and 0005, and the contracts that mention `.idlip.tsx`, through change requests.

## Acceptance

- [ ] `compile()` and `idlip/vite` reject `.idlip.tsx` with an error naming the DSL.
- [ ] No public subpath or export exists only for writing TSX views.
- [ ] `@idlip/tsc` and the language server still type-check `.idlip` files.
- [ ] The full check and e2e pass.

## Sizing

M: removal plus docs.

Dropped 2026-11-21 by debate `debates/dsl`: TSX stays the one source syntax (option B).
