---
id: markup-v2
title: Parser, lowering and tools for markup v2
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
size: L
spike: false
hypothesis:
verify: pnpm build && pnpm test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - packages/idlip/src/compiler/markup/**
  - packages/idlip/test/compiler/markup/**
  - packages/language-core/**
  - packages/tsc/**
  - packages/language-server/**
  - packages/vscode/**
shared:
  - packages/idlip/src/compiler/index.ts
  - packages/idlip/src/vite/plugin.ts
reserves: []
provides: []
depends_on:
  - on: markup-syntax-v2
    kind: contract
    via: markup-grammar
---

# Parser, lowering and tools for markup v2

## Goal

Implement `contracts/markup-grammar.md` v2 (from `markup-syntax-v2`): the scanner and parser read top-level TS statements then top-level markup; the lowering builds the internal TS module the analyzer reads (props from `Props`, no user-written wrapper); spans map back by offset; `@idlip/language-core`, `@idlip/tsc`, the language server and the VS Code grammar follow. Update the v1 fixtures and tests, and the `todo-idlip` example. Read the outcome of `markup-syntax-v2` for the list of changes.

## Acceptance

- [ ] Every v2 fixture parses, lowers to its expected module and passes `analyze()`.
- [ ] `examples/todo-idlip` is v2 and passes the e2e suite with the same request set.
- [ ] `idlip-tsc` reports a type error at the `.idlip` position in a v2 file; the language server gives hover and diagnostics.
- [ ] Full check passes.

## Sizing

L: rework of four story nodes against a new grammar. Split if the worker finds it too big.
