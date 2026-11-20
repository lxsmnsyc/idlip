---
id: write-sets
title: Write sets for update handlers and parallel chunk loading
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
size: M
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
  - on: compile-update
    kind: hard
    why: extends the handler analysis
  - on: resume-loader
    kind: hard
    why: changes the load order on the first event
---

# Write sets for update handlers and parallel chunk loading

## Goal

Implement the Write sets section of `docs/proposals/0003-update-analysis.md`. The update analysis records the model paths each handler writes, and the manifest lists them with the binding groups they can affect. On an event the loader fetches the handler chunk and those binding chunks in parallel, and diffs only along the write set. Unresolved handlers keep the current order.
