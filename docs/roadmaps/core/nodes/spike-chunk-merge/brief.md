---
id: spike-chunk-merge
title: Spike: does merging chunks speed up the first click
status: done
priority: should
type: spike
story:
early: false
outline: false
milestone: apps
target:
ship: auto
land: auto
from:
size: S
spike: true
hypothesis:
verify:
exclusive: [bench]
fulfilled_by:
gate: false
added: 2026-11-21
spent: 0
owns:
  - benchmarks/idlip-merge/**
shared: []
reserves: []
provides: []
depends_on:
  - on: benchmarks
    kind: hard
    why: uses the bench harness and idlip app
---

# Spike: does merging chunks speed up the first click

## Goal

Answer: does merging chunks under 4096 B per module give a faster cold first click at 150 ms RTT than the current split?

## Context

- Brumate's merge option: `../brumate/packages/brumate/src/codegen/client.ts`.
- Use a local Vite or rolldown config in the bench app. No package change.
- Record both waterfalls in `outcome.md`.

## Acceptance

- [x] `outcome.md` holds both waterfalls, the first-click times and a recommendation.

## Sizing

One measurement on an existing bench app.

Landed as d6e0301 on `batch/core`. Result: keep the split, no merge threshold; parallel loading from `write-sets` gives the same first click as merging (212 ms vs 222 ms uncompressed, 215 vs 205 gzip, both 1 round trip; split was 371 ms).
