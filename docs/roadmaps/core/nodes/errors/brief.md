---
id: errors
title: Errors from handlers, effects, rendering and chunk loads
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
  - on: resume-loader
    kind: hard
    why: wraps handler dispatch
  - on: commands-subs
    kind: hard
    why: failed commands report through the same path
  - on: ssr-render
    kind: hard
    why: server fallbacks render inside the server renderer
  - on: patch-bindings
    kind: hard
    why: client fallbacks replace a region when a patch throws
---

# Errors from handlers, effects, rendering and chunk loads

## Goal

When a handler throws, the model stays as it was and the client fires an `idlip:error` window event with the tag and the error. A chain of `cmd.send` messages stops after a fixed number of rounds with an error, as brumate stops after 10,000 binding rounds.

Error boundaries per module (`docs/proposals/0004-effects-refs-errors.md`, Error boundaries): a module's `catch(error)` view renders in place on the server when its render throws, and replaces its region on the client when a patch throws. A failed chunk load retries once, then fires `idlip:error`. A task rejection with no `err` tag fires `idlip:error`.
