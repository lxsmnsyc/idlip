---
id: differential-children
title: Generated model states for child components in the differential render test
status: todo
priority: could
type: test
story:
early: false
outline: false
milestone: 0.1
target:
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify: pnpm --filter idlip build && pnpm --filter idlip test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-22
spent:
owns:
  - packages/idlip/test/differential/**
shared:
  - packages/idlip/src/testing/**
reserves: []
provides: []
depends_on:
  - on: multi-component-files
    kind: hard
    why: children change shape with several components per file
---

# Generated model states for children

Follow-up from `differential-render-test`: the four subjects with children (nested board, example board, example board with subscriptions, parent) skip the model-pair check, so child models get no generated states, and a click on a child's own button is excluded. The worker's outcome describes a cheap way: expose the loader's root and child units from `mount`, set a child's model through the loader, and fill `context.slots` from the live children's models for the server render. Do that, and include clicks on child buttons.

## Updates 2026-11-22

- `multi-component-files` made `mount`'s server-render check render each child from its slot model, so clicks on a child's own button are now checked for the `widgets` subject. Model pairs for children are still missing; existing child subjects still click only root handlers.
