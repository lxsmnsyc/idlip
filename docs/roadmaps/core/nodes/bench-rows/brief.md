---
id: bench-rows
title: Rendering benchmark scenarios (rows and dashboard)
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
size: L
spike: false
hypothesis:
verify: pnpm -C benchmarks/harness bench --scenario rows --only idlip,brumate,marko --rounds 1
exclusive: [bench]
fulfilled_by:
gate: false
added: 2026-11-21
spent: 420000
owns:
  - benchmarks/**
shared:
  - pnpm-lock.yaml
reserves: []
provides: []
depends_on:
  - on: bench-brumate-latest
    kind: hard
    why: adds scenarios to the brumate app and the harness that node changes
---

# Rendering benchmark scenarios

## Goal

The idlip harness measures rendering, not only the first click. Port brumate's `rows` scenario (the js-framework-benchmark operations) and its `dashboard` scenario, so idlip is compared with brumate latest and Marko 6 on client updates and SSR at scale.

## Context

- Source: `~/Documents/GitHub/brumate/benchmarks`: `harness/rows.mjs`, `harness/client.mjs`, `harness/dashboard.mjs`, `harness/frameworks.mjs` (`SCENARIOS`, `loadApp`), `harness/report.mjs`, and each app's `rows/` and `dashboard/` folders with the `build:rows` and `build:dashboard` scripts and `loadRows()` / `loadDashboard()` in `adapter.js`. The README there lists the metrics.
- Rows metrics: create, replace, update every 10th, select, swap, remove, create 10,000, append, clear, first update from a server page, SSR renders/s at 1,000 rows. Main thread from click to paint, median of 10 runs.
- Dashboard metrics: JS before `load`, JS fetched while idle, total JS after 3 widgets, SSR HTML, SSR renders/s, first click.
- Apps to port: `idlip` (write it as `*.idlip.tsx` with `<For>` and keys), `brumate` (latest, from `bench-brumate-latest`), `marko`. Qwik columns stay todos-only unless porting them is cheap.
- If a rows operation cannot be written in idlip today (for example swap needs keyed moves), say so in the README and leave the cell empty; do not change `packages/` here. That gap goes to `perf-from-bench`.

## Acceptance

- [ ] `bench --scenario rows` and `bench --scenario dashboard` run for idlip, brumate and marko and print tables.
- [ ] Each idlip app checks its result in the page (row count, selected row, widget content) before it is timed, like the brumate apps do.
- [ ] `benchmarks/README.md` has both tables from one run with commit, date, machine and load, and extends the "Where idlip loses" list.

## Sizing

L: two scenarios, three apps each, and harness code, from a known source. Split dashboard into its own node if rows alone is M or larger.

## Notes for the worker

- `exclusive: bench`: no other benchmark run at the same time.
- Do not hide rows where idlip loses.
