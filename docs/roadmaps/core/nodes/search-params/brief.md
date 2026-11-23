---
id: search-params
title: Keep model fields in the URL search params
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
size: M
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
    why: params belong to a route
---

# Keep model fields in the URL search params

Filters, tabs and pagination should survive a reload and be shareable as links. Brumate has `$searchParam`.

To settle when refined: how a component declares that a model field mirrors a search param without a compile-time API (a prop the route provides, or a message), parse and serialize rules, history entries (push or replace), and server render from the URL.
