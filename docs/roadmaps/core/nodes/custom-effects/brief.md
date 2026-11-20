---
id: custom-effects
title: Custom effects: tasks and subscriptions from module-level functions
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
  - on: commands-subs
    kind: hard
    why: built-in commands become tasks on the same executor path
  - on: compile-update
    kind: hard
    why: the compiler gives each task and subscription an id and a chunk
---

# Custom effects: tasks and subscriptions from module-level functions

## Goal

`task()` and `defineSub()` from `docs/proposals/0004-effects-refs-errors.md`, Custom effects. A task wraps a module-level async function, runs from `task.run(input, to, err)`, and supports the `all`, `latest` and `queue` modes and `Task.cancel`. A custom subscription has `start`, optional `update` and `stop`, and the runtime diffs active subscriptions by id and args. `Time.after` and the built-in `Http` and `Storage` commands run as tasks. Tasks never run on the server.
