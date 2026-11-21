---
id: element-subs
title: Element lifecycle subscriptions
status: todo
priority: could
type: feature
story:
early: false
outline: true
milestone: 
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
  - on: commands-subs
    kind: hard
    why: built on the subscription executors
---

# Element lifecycle subscriptions

## Goal

Subscriptions for elements, such as visibility and idle triggers on a ref, in the subscription design of `commands-subs`, for third-party widgets and measuring. Brumate's `load`, `idle` and `visible` triggers are in `../brumate/packages/brumate/src/runtime/boot.ts`.
