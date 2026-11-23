---
id: navigation
title: Move between pages without a full reload
status: todo
priority: should
type: feature
story:
early: false
outline: true
milestone: '0.2'
target:
ship: auto
land: auto
from:
size: L
spike: false
hypothesis:
verify: 
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-23
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: routing
    kind: hard
    why: navigates between its routes
---

# Move between pages without a full reload

With routing, a link to another page should load only what changes and keep layout state, as brumate's client navigation does. Read brumate `navigation.md`.

To settle when refined: what the server sends for a navigation (the next page's markup and state), how the loader resumes the new page, layouts keeping their model, scroll and focus, prefetch on hover, back and forward, and the loader budget (behind a flag).
