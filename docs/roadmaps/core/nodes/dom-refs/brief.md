---
id: dom-refs
title: Element refs for commands, tasks and subscriptions
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
    why: tasks and subscriptions receive resolved elements
  - on: patch-lists
    kind: hard
    why: refs inside <For> are keyed by item
---

# Element refs for commands, tasks and subscriptions

## Goal

`ref` attributes and `ref()` values from `docs/proposals/0004-effects-refs-errors.md`, Refs. The runtime resolves a ref to its element, scoped by module path and list key. Commands: `Dom.focus`, `Dom.scrollIntoView`, `Dom.measure`. `Dom.focus` from 0003 takes a ref instead of a selector, so `form-fields` adopts it.
