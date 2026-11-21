---
id: markup-parser
title: Markup scanner and parser
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
verify: pnpm --filter idlip exec vitest run test/compiler/markup/parse
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - packages/idlip/src/compiler/markup/scan.ts
  - packages/idlip/src/compiler/markup/parse.ts
  - packages/idlip/src/compiler/markup/ast.ts
  - packages/idlip/test/compiler/markup/parse/**
shared: []
reserves: []
provides: []
depends_on:
  - on: markup-syntax
    kind: contract
    via: markup-grammar
---

# Markup scanner and parser

## Goal

Scan and parse `.idlip` source into an AST with source spans for every token, following `markup-grammar`.

## Context

- Files: `packages/idlip/src/compiler/markup/scan.ts`, `parse.ts`, `ast.ts`.
- Parse errors carry a span and a rule id.

## Acceptance

- [ ] Each fixture in `test/compiler/markup/fixtures` parses to an AST whose spans cover the source.
- [ ] Malformed blocks give an error with the span of the block.
- [ ] Fast check passes: `pnpm --filter idlip exec vitest run test/compiler/markup/parse`

## Sizing

One parser over a frozen grammar.
