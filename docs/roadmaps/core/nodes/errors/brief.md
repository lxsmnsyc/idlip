---
id: errors
title: Errors: throwing handlers, chunk loads and boundaries
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

# Errors: throwing handlers, chunk loads and boundaries

## Goal

When a handler throws, the model stays as it was and the client fires an `idlip:error` window event with the tag and the error. A chunk that fails to load is retried once, then fires `idlip:error`, which `deploy-skew` can handle. Error boundaries wait for their design: `docs/proposals/0004-effects-refs-errors.md`, Open questions.
