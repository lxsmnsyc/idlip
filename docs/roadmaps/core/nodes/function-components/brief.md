---
id: function-components
title: Function components compiled to defineModule
status: dropped
priority: should
type: feature
story:
early: false
outline: true
milestone:
target:
ship: auto
land: auto
from:
size: XL
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
  - on: nesting
    kind: hard
    why: child slots and message props reuse the nesting routing
  - on: release-0-1
    kind: hard
    why: planned for the milestone after 0.1
---

# Function components compiled to defineModule

## Goal

Dropped on 2026-11-21. Function components became the only way to write a module (`docs/proposals/0002-modules.md`, revised 2026-11-21), so there is no `defineModule` form to compile to. The work moved into `spike-view-analysis` (the component body), `compile-update` (handler functions), `nesting` (child components in JSX) and `custom-effects` (`await` in handlers).
