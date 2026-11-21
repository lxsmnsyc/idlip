---
id: custom-effects
title: Async handlers: await compiled into a task and a continuation
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
    why: builds on the finished handler compiler and loader
  - on: compile-update
    kind: hard
    why: the compiler gives each task and subscription an id and a chunk
---

# Async handlers: `await` compiled into a task and a continuation

## Goal

`docs/proposals/0004-effects-refs-errors.md`, Effects, and the `await` rule of `docs/proposals/0002-modules.md`. The compiler splits an async handler at each `await`: the part before is the handler's message, the awaited call is a task chunk that runs on the client, and the rest is a continuation message (`persist$1`) whose payload is the result or the error and the locals that live across the `await`. `try` and `catch` around an `await` route a rejection. `runTask` from `contracts/compiled-format.md` runs tasks. Tasks never run on the server.
