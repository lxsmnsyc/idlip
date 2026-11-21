---
id: commands-subs
title: Subscriptions in the view, and the Random and Time functions
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
verify: pnpm --filter idlip exec vitest run test/effects
exclusive: []
fulfilled_by:
gate: false
added:
spent:
owns:
  - packages/idlip/src/effects/**
  - packages/idlip/test/effects/**
shared:
  - packages/idlip/src/index.ts
reserves: []
provides: []
depends_on:
  - on: core-api
    kind: contract
    via: core-api
  - on: compiled-format
    kind: contract
    via: compiled-format
  - on: resume-loader
    kind: behavior
    via: compiled-format
---

# Subscriptions in the view, and the Random and Time functions

## Goal

Subscriptions in the view, from `docs/proposals/0004-effects-refs-errors.md`, Subscriptions: `<window>` and `<document>` listeners, and `<Subscribe to={source} input={...} on:value={handler}>` for module-level async generators. A subscription starts and stops with the block it sits in. The server renders a marker per active subscription and the loader starts them on resume. A changed `input` restarts the run. `Random` and `Time` (`contracts/core-api.md`) land here too.
