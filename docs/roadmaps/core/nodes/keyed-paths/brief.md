---
id: keyed-paths
title: Keyed path segments in view and update analysis
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
  - on: write-sets
    kind: hard
    why: keyed writes are a kind of write set
  - on: patch-lists
    kind: hard
    why: item lookup by key reuses the list patcher
---

# Keyed path segments in view and update analysis

## Goal

Implement the Keyed paths section of `docs/proposals/0003-update-analysis.md`. Paths such as `todos[id=$p].done` and `todos[id=selected].text` become static. A keyed write then compares one item, and a lookup by key is no longer a `dynamic` hole.
