---
id: bench-brumate-latest
title: Benchmark against the latest brumate
status: done
priority: should
type: feature
story:
early: false
outline: false
milestone: 0.1
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm -C benchmarks/harness bench --scenario todos --only idlip,brumate,marko --rounds 1
exclusive: [bench]
fulfilled_by:
gate: false
added: 2026-11-21
spent: 261000
owns:
  - benchmarks/brumate/**
  - benchmarks/harness/**
  - benchmarks/README.md
shared:
  - pnpm-lock.yaml
reserves: []
provides: []
depends_on:
  - on: benchmarks
    kind: hard
    why: adds a framework to the harness that node built
---

# Benchmark against the latest brumate

## Goal

The todos table compares idlip with the latest published brumate, not only brumate 0.3.0. The README carries a fresh run and a list of the rows where idlip loses, which `perf-from-bench` works from.

## Context

- Latest brumate on npm is 0.8.1 (check `npm view brumate version` at start and use what it says). Brumate's own app is `~/Documents/GitHub/brumate/benchmarks/brumate` (todos in `src/`), built against its workspace package; copy it and pin the npm version instead.
- Keep `brumate-0.3` as a column; it shows the lazy-loading design idlip shares.
- Fix the count reader from `inbox.md`: the harness reads `/(\d+) left/` over the page body and can read "32". Read the count element (`ul + p`) instead.
- Brumate's harness (`~/Documents/GitHub/brumate/benchmarks/harness`) may have measurement fixes since the port. Port fixes that change the todos numbers; note them in the README.

## Acceptance

- [ ] `benchmarks/brumate` builds brumate at the npm latest and the harness measures it in the todos scenario.
- [ ] `benchmarks/README.md` has a full todos run (all columns) with commit, date, machine and load, and a "Where idlip loses" list naming each metric where idlip is behind brumate latest or Marko by more than the noise (20% on a busy machine; use perf-pass `bench.py` rules for timings).
- [ ] The count reader fix has a check that fails on the "32" case.

## Sizing

M: one app copied from a known source, one harness fix, one long run.

## Notes for the worker

- Run the benchmark when no other bench is running (`exclusive: bench`). Record the load average.
- Do not hide rows where idlip loses.
