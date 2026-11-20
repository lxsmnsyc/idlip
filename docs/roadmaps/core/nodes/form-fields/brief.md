---
id: form-fields
title: Form field placeholders and Dom commands
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
    why: Dom.reset and Dom.focus are commands with lazy executors
---

# Form field placeholders and Dom commands

## Goal

Implement the Form fields section of `docs/proposals/0003-update-analysis.md`. It covers:

- the `["$form", name]` placeholder, read from `FormData` at dispatch
- the `event.form` types
- default `preventDefault()` on `on:submit`
- the `Dom.reset` and `Dom.focus` commands (`Dom.focus` switches from a selector to a ref when `dom-refs` lands, see `docs/proposals/0004-effects-refs-errors.md`)
