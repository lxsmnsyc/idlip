---
id: analyze-v9
title: Compiler: event modifiers and the view-ir v9 rules in the analysis
status: active
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
size: S
spike: false
hypothesis:
verify: pnpm --filter idlip exec vitest run test/compiler/view/analyze
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - packages/idlip/src/compiler/view/analyze/**
  - packages/idlip/test/compiler/view/analyze/**
shared: []
reserves: []
provides: []
depends_on:
  - on: compile-view-analyze
    kind: hard
    why: extends the analysis code that node wrote
  - on: compiled-format
    kind: contract
    via: view-ir
---

# Compiler: event modifiers and the view-ir v9 rules in the analysis

## Goal

Bring the analysis from view-ir v8 to v9, which `compiled-format` added after `compile-view-analyze` landed.

## Context

- `contracts/view-ir.md` v9: Events (block-bodied arrows, modifiers) and the Diagnostics table.
- `contracts/view-ir-v9.change-request.md` lists the exact forms.
- `nodes/compile-view-analyze/outcome.md`.
- `packages/idlip/test/fixtures/todo/todo.idlip.tsx` uses both modifier forms; today the analysis reports them as `event-closure`.

## Acceptance

- [ ] `(e) => { e.preventDefault(); add(); }` gives `modifiers: [{ kind: 'prevent' }]`, `e.stopPropagation()` gives `stop`, and `if (e.key === 'Escape') { clear(); }` gives a `key` modifier with filter `Escape`, including `Ctrl+`/`Alt+`/`Shift+`/`Meta+` forms.
- [ ] Other block bodies stay `event-closure`.
- [ ] `attr-reserved`, `event-placeholder`, `html-raw-text` and `event-passive-prevent` exist, and each one the analysis can produce fires on a fixture marker. `html-nesting` covers text holes in table parts across blocks.
- [ ] The todo fixture source of `compiled-format` analyzes with 0 diagnostics, and its hole ids and path sets match its manifest.
