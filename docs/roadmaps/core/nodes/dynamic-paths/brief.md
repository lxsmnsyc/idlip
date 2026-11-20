---
id: dynamic-paths
title: Runtime path tracking for dynamic holes
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
  - on: example-todo
    kind: hard
    why: builds on the shipped analysis, server renderer and binding patcher
  - on: keyed-paths
    kind: hard
    why: keyed paths turn lookups by key into static holes, which shrinks this node
---

# Runtime path tracking for dynamic holes

## Goal

Replace the compile error for `dynamic` holes with a runtime fallback, as in `docs/proposals/0002-modules.md`, section Path tracking. The server evaluates each dynamic hole with a model proxy that records reads and writes the paths into the state script. After each patch, the client evaluates the hole again and stores the new paths.
