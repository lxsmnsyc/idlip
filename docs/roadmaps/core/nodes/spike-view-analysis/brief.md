---
id: spike-view-analysis
title: Spike: model path analysis of view JSX with oxc
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

# Spike: model path analysis of view JSX with oxc

## Goal

Answer: can an oxc pass compute, for every hole in a view, the set of model paths it reads, including `<For>` item paths, conditions written as JSX ternaries or `&&`, and helper calls? Freeze the view IR the analysis produces.

## Context

- Source: `docs/proposals/0001-dsl.md`, View rules table, and `docs/proposals/0002-modules.md`, sections Module, Partials and Path tracking.
- The view is the `view(m, msg)` property of the `defineModule` default export. Message constructors are calls on its second parameter.
- Use `oxc-parser` (the same parser brumate uses, see `../brumate/packages/brumate/package.json`).
- Contract to freeze: `contracts/view-ir.md`.
- Why TSX for now: `debate/debate.md`. A DSL with blocks may replace the view syntax after the PoC, so keep syntax-specific code at the front of the pass.

## Acceptance

- [ ] A prototype under this node folder analyzes the todo view from the proposal and prints the path set per hole.
- [ ] `outcome.md` answers: which constructs resolve to exact paths, which are `dynamic` holes, and which must be compile errors. Partials must resolve by inlining.
- [ ] The prototype enforces the closed grammar and the helper rule from `contracts/view-ir.md`, including inlining single-expression helpers, and reports violations with rule ids.
- [ ] `contracts/view-ir.md` describes the IR (template tree, holes, path sets, events, list and condition blocks) and is frozen.

## Sizing

M with high uncertainty, time-boxed. The code is a prototype, not shipped.

## Notes for the worker

- Path sets use `*` for a list item: `todos.*.done`.
- Record which element nestings the HTML parser rewrites (`<div>` inside `<p>`, `<li>` outside a list, table rows outside table sections). The analysis should report them as diagnostics. Brumate's list is in `../brumate/website/docs/page-format.md`, section Elements.
- Destructuring (`const { todos } = m`) and aliases must either resolve or be rejected. Record which.
