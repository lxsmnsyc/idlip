---
id: nesting
title: Nested components routed by model path
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

# Nested components routed by model path

## Goal

Child components as in `docs/proposals/0002-modules.md`, section Props and nesting. `<Counter start={0} />` in a parent's JSX gets a slot in the parent's model, named by `key`, by the `<For>` key or by position. A child's messages carry its model path. A callback prop such as `onRemove={() => remove(c.id)}` compiles to a message prop, dispatched with the parent's path. Decide whether `key` is required on stateful children (0002, Open questions).
