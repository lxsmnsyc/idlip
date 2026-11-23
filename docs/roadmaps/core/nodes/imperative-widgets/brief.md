---
id: imperative-widgets
title: Run imperative widgets (charts, maps, editors) on an element
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
  - on: element-subs
    kind: hard
    why: builds on element lifecycle subscriptions
---

# Run imperative widgets (charts, maps, editors) on an element

There is no supported way to start a third-party widget on an element, feed it model changes and get its events back as messages. Brumate has client modules (`client-modules.md`).

To settle when refined: when the widget code loads (on visible, on interaction, on idle), how model changes reach it without running component code, cleanup, and how its events become messages.
