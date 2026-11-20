---
id: nesting
title: Nested modules routed by model path
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

# Nested modules routed by model path

## Goal

Child modules routed by model path, as in `docs/proposals/0002-modules.md`, section Nesting: `children()` and `list()` in `update`, `<Child.View model={...} />` in the view, and message props with `cmd.send`. No mapping closures.
