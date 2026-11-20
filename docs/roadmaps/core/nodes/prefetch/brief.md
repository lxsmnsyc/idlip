---
id: prefetch
title: Prefetch chunks for messages present in the page
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
added:
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: example-todo
    kind: hard
    why: needs the real chunk graph to measure against
  - on: write-sets
    kind: behavior
    via: compiled-format
---

# Prefetch chunks for messages present in the page

## Goal

Preload update and binding chunks likely needed by messages in the DOM, so the first click does not wait on the network.
