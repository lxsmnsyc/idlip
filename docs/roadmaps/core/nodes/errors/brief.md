---
id: errors
title: Errors from handlers, commands and message loops
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
size: S
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
  - on: resume-loader
    kind: hard
    why: wraps handler dispatch
  - on: commands-subs
    kind: hard
    why: failed commands report through the same path
---

# Errors from handlers, commands and message loops

## Goal

When a handler throws, the model stays as it was and the client fires an `idlip:error` window event with the tag and the error. A chain of `cmd.send` messages stops after a fixed number of rounds with an error, as brumate stops after 10,000 binding rounds.
