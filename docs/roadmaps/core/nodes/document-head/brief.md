---
id: document-head
title: Document head
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

# Document head

## Goal

`docs/proposals/0004-effects-refs-errors.md`, Open questions, Document head. The candidate: a root component renders the whole document, `<html>` with `<head>` and `<title>`, and its holes patch like any other. `<title>` text changes as whole content. A nested component's head waits for the markup DSL. Write the full brief after the design is accepted.
