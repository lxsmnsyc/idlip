---
id: form-fields
title: Form fields in event arrows
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
  - on: dom-refs
    kind: hard
    why: Dom.reset and Dom.focus take ref names
---

# Form fields in event arrows

## Goal

Redesign and implement the Form fields section of `docs/proposals/0003-update-analysis.md` for event arrows (`docs/proposals/0002-modules.md`, revised 2026-11-21). The `event.form` placeholder no longer exists. Decide how a submit handler gets field values, for example property paths on `e.currentTarget.elements`, read at dispatch like other event paths. Default `preventDefault()` on `on:submit`. `Dom.reset` and `Dom.focus` come from `dom-refs`.
