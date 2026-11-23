---
id: prerender
title: Prerender pages to static HTML at build time
status: todo
priority: could
type: feature
story:
early: false
outline: true
milestone: 
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
    why: prerenders its routes
---

# Prerender pages to static HTML at build time

Pages whose data is known at build time could ship as static HTML that still resumes. Brumate can prerender pages. To settle when refined: which routes and params, how the state script and skew build id work for static files, and Nitro's prerender support.
