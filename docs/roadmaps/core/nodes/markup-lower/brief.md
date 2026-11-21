---
id: markup-lower
title: Lower markup to TSX with offset mappings
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
verify: pnpm --filter idlip exec vitest run test/compiler/markup/lower
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - packages/idlip/src/compiler/markup/lower.ts
  - packages/idlip/test/compiler/markup/lower/**
shared: []
reserves: []
provides: []
depends_on:
  - on: markup-parser
    kind: hard
    why: lowering consumes the real AST and spans
---

# Lower markup to TSX with offset mappings

## Goal

`toTypeScript()` turns the AST into TSX the existing analyzer accepts, and returns offset mappings between the `.idlip` source and the TSX.

## Context

- Expected output is the `*.tsx.txt` fixtures from `markup-syntax`.
- Mappings are used by `markup-compile` for errors and by `markup-language-core` for editor features.

## Acceptance

- [ ] Output equals the expected TSX for every fixture.
- [ ] Mappings round-trip: a position in each hole maps to the same text in the TSX.
- [ ] Fast check passes: `pnpm --filter idlip exec vitest run test/compiler/markup/lower`

## Sizing

One emitter plus mappings.
