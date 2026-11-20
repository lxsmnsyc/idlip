---
id: document-head
title: Document title and meta from the root module
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
  - on: ssr-render
    kind: hard
    why: the server writes the head
  - on: patch-bindings
    kind: hard
    why: head values patch like bindings
---

# Document title and meta from the root module

## Goal

The root module's `head(m)` from `docs/proposals/0004-effects-refs-errors.md`, Document head. The server writes `<title>` and meta tags, and they patch when their paths change. `head` on a nested module is a compile error.
