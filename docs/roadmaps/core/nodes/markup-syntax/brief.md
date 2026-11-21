---
id: markup-syntax
title: Markup syntax proposal and fixtures
status: done
priority: should
type: contract
story: markup-frontend
early: true
outline: false
milestone: apps
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter idlip exec vitest run test/compiler/markup
exclusive: []
fulfilled_by:
gate: true
added: 2026-11-21
spent: 151894
owns:
  - docs/proposals/0005-markup.md
  - packages/idlip/test/compiler/markup/fixtures/**
shared: []
reserves:
  - proposal 0005
provides:
  - markup-grammar
depends_on: []
---

# Markup syntax proposal and fixtures

## Goal

Write `docs/proposals/0005-markup.md` and the grammar for `.idlip` files, with paired fixtures (`*.idlip.txt` and the expected `*.tsx.txt`). A `.idlip` file is a plain TS module: imports, types and helpers at top level. Components are plain functions as in 0002. Markup appears only as the final `return` of a capitalized function, with JSX-style attributes and events. Blocks: `#if`, `#else if`, `#else`, `#for (t, i of todos by t.id)`, `#switch`, `#case`, `#default`, `#try`, `#catch (error, reset)`, `#head`. `<subscribe>`, `<window>` and `<document>` are lowercase built-ins. Block components are never imported.

## Context

- Early: `document-head`, `errors` and `commands-subs` need the block-to-component mapping.
- Write the proposed contract text in this node's folder as `markup-grammar.md`; the orchestrator copies it to `contracts/markup-grammar.md` at the gate.
- Open question for the gate: GOAL.md says one published package, but tooling needs `@idlip/language-core`, `@idlip/tsc` and a private VS Code extension. Options: one package with subpaths, or separate packages. The user decides.
- Existing analyzer input: TSX as in the todo example.

## Acceptance

- [x] Every expected TSX fixture passes `analyze()` with no errors.
- [x] The grammar covers each block above, with one fixture each, and says how errors and spans map.
- [x] The open package question is stated for the gate.
- [x] Fast check passes: `pnpm --filter idlip exec vitest run test/compiler/markup`

## Sizing

Design work with fixtures; gate because all later markup nodes follow it.
