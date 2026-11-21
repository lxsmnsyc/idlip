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

`<Try catch={(error, reset) => ...}>` boundaries from `docs/proposals/0004-effects-refs-errors.md`, Error boundaries: the server renders the `catch` view in place of a body that throws, and the client swaps a boundary's region when a binding or a subscription source inside it throws, keeping the model. `reset` renders the body again. A handler that throws keeps the model and fires `idlip:error`. A chunk that fails to load is retried once, then fires `idlip:error`.
