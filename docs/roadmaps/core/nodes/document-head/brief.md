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

`<Head>` blocks from `docs/proposals/0004-effects-refs-errors.md`, Document head, with brumate's rules: anywhere in the markup, `<meta>` and `<link>` added and removed with their block, the last title wins and sets `document.title`, and the server writes the last title first. `<title>` outside `<Head>` is a compile error, except in `<svg>`.
