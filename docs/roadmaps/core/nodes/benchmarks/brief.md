---
id: benchmarks
title: Benchmarks against Qwik, Marko and brumate
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
    why: needs the working todo example
---

# Benchmarks against Qwik, Marko and brumate

## Goal

Measure bytes loaded and time to first interaction for the todo app against Qwik, Marko and brumate, like brumate/benchmarks.

- Measure the first click at 150 ms RTT. With one chunk per handler and per binding group, round trips can cost more than bytes.
- Compare the current split with a merge threshold, like brumate's 4096 B `merge` option, and report which gives the faster first click.
