---
id: size-budgets
title: Size budgets that fail the build
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
size: S
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
  - on: benchmarks
    kind: hard
    why: budgets start from the measured sizes
---

# Size budgets that fail the build

## Goal

The build reports the gzip size of the loader and of each chunk, and fails when one goes over its budget. Brumate's report is `../brumate/packages/brumate/src/report.ts`.

## Updates after wave 7

- The loader budget of 4096 B gzip is the loader with no optional features. Each `HAS_*` flag adds its cost when an app uses it (tasks +274 B, keyed paths +124 B at the time of `runtime-flags`). Report the size of the loader built for the app, name the features it carries, and fail only when the app's loader exceeds the base budget plus the reported cost of the features it uses. `src/vite/features.ts` has `getFeatures`, which gives the set.
