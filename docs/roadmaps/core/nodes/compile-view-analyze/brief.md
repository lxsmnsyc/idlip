---
id: compile-view-analyze
title: Compiler: analyze view model paths and report errors
status: todo
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
verify: pnpm --filter idlip exec vitest run test/compiler/view/analyze
exclusive: []
fulfilled_by:
gate: false
added:
spent:
owns:
  - packages/idlip/src/compiler/view/analyze/**
  - packages/idlip/test/compiler/view/analyze/**
shared: []
reserves: []
provides: []
depends_on:
  - on: spike-view-analysis
    kind: contract
    via: view-ir
---

# Compiler: analyze view model paths and report errors

## Goal

Turn the prototype from `spike-view-analysis` into the shipped analysis: view JSX to the view IR, with diagnostics for closures in events, `.map` lists and unresolvable model access.

## Context

- IR: `contracts/view-ir.md`. Findings: `nodes/spike-view-analysis/outcome.md`.

## Acceptance

- [ ] The todo and counter views produce the IR recorded in the contract examples.
- [ ] Each rule in the proposal's View rules table has a diagnostic test.
- [ ] Fast check passes: `pnpm --filter idlip test`
