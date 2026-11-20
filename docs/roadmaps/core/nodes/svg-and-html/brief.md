---
id: svg-and-html
title: SVG and MathML namespaces, and trusted raw HTML
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
  - on: compile-view-codegen
    kind: hard
    why: templates record their namespace
  - on: patch-lists
    kind: hard
    why: client-created rows use the namespace of their template
---

# SVG and MathML namespaces, and trusted raw HTML

## Goal

From `docs/proposals/0004-effects-refs-errors.md`, SVG, MathML and raw HTML. Templates inside `<svg>` and `<math>` keep their namespace, including rows and branches created on the client. `html={trusted(value)}` sets an element's content; a plain string is a type error and the element must have no children.
