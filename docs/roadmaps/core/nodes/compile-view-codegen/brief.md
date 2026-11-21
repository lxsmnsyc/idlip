---
id: compile-view-codegen
title: Compiler: emit server template and binding chunks from the view IR
status: done
priority: must
type: feature
story:
early: false
outline: false
milestone: todo-resumes
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter idlip exec vitest run test/compiler/view/codegen
exclusive: []
fulfilled_by:
gate: false
added:
spent: 373976
owns:
  - packages/idlip/src/compiler/view/codegen/**
  - packages/idlip/test/compiler/view/codegen/**
shared: []
reserves: []
provides: []
depends_on:
  - on: spike-view-analysis
    kind: contract
    via: view-ir
  - on: compiled-format
    kind: contract
    via: compiled-format
---

# Compiler: emit server template and binding chunks from the view IR

## Goal

From the view IR, emit the server render module, the binding group chunks (grouped by path set), the list item template chunks and the manifest, as a function over the IR. `compile-integration` wires it into `compile()`.

## Context

- Input: `contracts/view-ir.md`. Output: `contracts/compiled-format.md`, fixtures in `packages/idlip/test/fixtures/*/`.

## Acceptance

- [ ] For both fixtures, IR in gives the expected server module, chunks and manifest.
- [ ] Fast check passes: `pnpm --filter idlip test`

## Notes for the worker

- Build against a hand-written IR for each fixture. The analysis is built at the same time by `compile-view-analyze`.

Landed on `batch/core` as f18dc6a. Follow-up for `compile-integration`: export one component picker from `compiler/update` and use it in codegen.
