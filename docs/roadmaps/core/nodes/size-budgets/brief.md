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
