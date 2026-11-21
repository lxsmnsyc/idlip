---
id: dom-refs
title: Refs and Dom functions
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
  - on: custom-effects
    kind: hard
    why: `await Dom.measure` uses the task path
  - on: patch-lists
    kind: hard
    why: refs inside <For> are keyed by item
---

# Refs and `Dom` functions

## Goal

`ref` attributes from `docs/proposals/0004-effects-refs-errors.md`, Refs, and the runtime functions `Dom.focus`, `Dom.scrollIntoView`, `Dom.measure` and `Dom.reset`, called in handlers with a ref name. The runtime resolves a name to its element, scoped by component path and list key. `Dom.measure` is awaited, so it runs through the task path of `custom-effects`.
