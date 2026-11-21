---
id: spike-view-analysis
title: Spike: analyze function components and view model paths with oxc
status: todo
priority: must
type: spike
story:
early: false
outline: false
milestone: todo-resumes
target:
ship: auto
land: auto
from:
size: M
spike: true
hypothesis:
verify: 
exclusive: []
fulfilled_by:
gate: false
added:
spent:
owns:
  - docs/roadmaps/core/nodes/spike-view-analysis/**
shared: []
reserves: []
provides:
  - view-ir
depends_on: []
---

# Spike: analyze function components and view model paths with oxc

## Goal

Answer: can an oxc pass read a function component's body into state fields, derived values, handlers and a view, and compute for every hole the set of model paths it reads, including `<For>` item paths, conditions written as JSX ternaries or `&&`, derived values, and helper calls? Freeze the view IR the analysis produces.

## Context

- Source: `docs/proposals/0001-dsl.md`, View rules table, and `docs/proposals/0002-modules.md`, sections Module, Partials and Path tracking.
- The input is a function component (`docs/proposals/0002-modules.md`, revised 2026-11-21): `let` state, `const` derived values, function declaration handlers and `return <jsx>`. Model paths start at state names. Event props are handler references or arrows with one handler call.
- Use `oxc-parser` (the same parser brumate uses, see `../brumate/packages/brumate/package.json`).
- Contract to freeze: `contracts/view-ir.md`.
- Why TSX for now: `debate/debate.md`. A DSL with blocks may replace the view syntax after the PoC, so keep syntax-specific code at the front of the pass.

## Acceptance

- [ ] A prototype under this node folder analyzes the todo component from 0002, Example, and prints its state fields, handlers with their free variables, and the path set per hole.
- [ ] `outcome.md` answers: which constructs resolve to exact paths, which are `dynamic` holes, and which must be compile errors. Stateless components and derived values must resolve by inlining.
- [ ] The prototype enforces the closed grammar, the helper rule and the body rules of 0002 (declarations only, the `let` type rule, event props), including inlining single-expression helpers, and reports violations with rule ids.
- [ ] `contracts/view-ir.md` describes the IR (template tree, holes, path sets, events, list and condition blocks) and is frozen.

## Sizing

M with high uncertainty, time-boxed. The code is a prototype, not shipped.

## Notes for the worker

- Path sets use `*` for a list item: `todos.*.done`.
- Record which element nestings the HTML parser rewrites (`<div>` inside `<p>`, `<li>` outside a list, table rows outside table sections). The analysis should report them as diagnostics. Brumate's list is in `../brumate/website/docs/page-format.md`, section Elements.
- Destructuring (`const { todos } = m`) and aliases must either resolve or be rejected. Record which.
