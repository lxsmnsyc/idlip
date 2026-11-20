---
id: function-components
title: Function components compiled to defineModule
status: todo
priority: should
type: feature
story:
early: false
outline: true
milestone: components
target:
ship: auto
land: auto
from:
size: XL
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-20
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: nesting
    kind: hard
    why: child slots and message props reuse the nesting routing
  - on: release-0-1
    kind: hard
    why: planned for the milestone after 0.1
---

# Function components compiled to defineModule

## Goal

Compile a function component into the `defineModule` form, as in `docs/proposals/0002-modules.md`, section Function components. `state` declarations become model fields and named functions become handlers. Free variables that are not state become payload fields. Child components get slots in the parent model. Split into a closure conversion spike and feature nodes when `plan.py refine` lists it.
