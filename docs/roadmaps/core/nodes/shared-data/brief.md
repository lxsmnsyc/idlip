---
id: shared-data
title: Read-only data shared with every component without props
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
depends_on: []
---

# Read-only data shared with every component without props

A child cannot read its parent's state, so app-wide data (signed-in user, theme, locale, feature flags) goes through props at every level. Brumate has context.

To settle when refined: an MVU form of context (values provided at the root or a layout, read-only below, changed only by messages to the provider), how it serializes once in the state script, how a change patches only the bindings that read it, and whether it is enough to make it part of routing's layouts. No compile-time marker APIs.
