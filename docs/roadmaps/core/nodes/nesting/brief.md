---
id: nesting
title: Nested modules with message prefixes
status: todo
priority: should
type: feature
story:
early: false
outline: true
milestone: apps
target:
ship: auto
land: auto
from:
size: L
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added:
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: example-todo
    kind: hard
    why: builds on the finished compiler and runtime
---

# Nested modules with message prefixes

## Goal

Child modules with `as` prefixes and `nest()` routing, as in the proposal section Nesting. No mapping closures.
