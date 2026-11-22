---
id: docs-benchmarks
title: Benchmarks page
status: todo
priority: should
type: docs
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
verify: pnpm --filter website check:samples && pnpm --filter website build
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - website/docs/benchmarks.md
  - website/src/benchmarks.json
shared: []
reserves: []
provides: []
depends_on:
  - on: website-polish
    kind: hard
    why: website-polish creates website/src/benchmarks.json and the landing section that reads it
  - on: website-scaffold
    kind: hard
    why: adds a Markdown page that the scaffold's build and sidebar process
  - on: benchmarks
    kind: hard
    why: the numbers and the method come from the benchmarks harness and its README
  - on: spike-chunk-merge
    kind: hard
    why: the first-click numbers change if chunk merging lands, so the page waits for the final ones
  - on: bench-rows
    kind: hard
    why: the page shows the rows and dashboard tables
  - on: perf-from-bench
    kind: hard
    why: the page shows the numbers after the performance work
---

# Benchmarks page

## Goal

One page with the benchmark table (idlip against brumate, Marko 6, Qwik 1 and Qwik 2), the scenario, how to reproduce it, and an honest reading: idlip loses the first-click round trips, wins on JS before `load`.

## Context

- Source: `benchmarks/README.md` (table, scenario, reading notes). Re-run `pnpm -C benchmarks/harness bench --scenario todos` on a quiet machine if the numbers there predate `spike-chunk-merge`, and record the commit, machine and load.
- The page is a static copy of the table. It names the date and the commit.

## Acceptance

- [ ] `website/docs/benchmarks.md` exists with the table, the scenario, the reproduce command and the caveats from the README (noisy machine, 20% rule).
- [ ] The numbers match a run at a commit named on the page.
- [ ] `pnpm --filter website build` passes.

## Sizing

S: one page. The only cost is a benchmark run.

## Notes for the worker

- Do not hide the rows where idlip loses.
- Follow the plain-writing skill.

## Updates after wave 9

- `prefetch` measured the cold first click with the links on: 60 ms against 221 ms off, at 150 ms RTT (`nodes/prefetch/outcome.md`, `benchmarks/prefetch/run.mjs`). Add it as a labelled row or note only if the page says prefetch is opt-in and loads two chunks before any click. The main table stays the default build.

## Updates after the bench nodes (2026-11-21)

- Columns: idlip, brumate latest (`benchmarks/brumate`), brumate 0.3.0, Marko 6, Qwik 1, Qwik 2 for todos; idlip, brumate, Marko for rows and dashboard (`bench-rows`).
- Use the run recorded after `perf-from-bench`, and copy its "Where idlip loses" list.

## Landing numbers (2026-11-22)

Also update `website/src/benchmarks.json`, the data file the landing page reads (`website-polish`), with the same numbers and run date as the page.
