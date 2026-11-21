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
shared: []
reserves: []
provides: []
depends_on:
  - on: website-scaffold
    kind: hard
    why: adds a Markdown page that the scaffold's build and sidebar process
  - on: benchmarks
    kind: hard
    why: the numbers and the method come from the benchmarks harness and its README
  - on: spike-chunk-merge
    kind: hard
    why: the first-click numbers change if chunk merging lands, so the page waits for the final ones
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
