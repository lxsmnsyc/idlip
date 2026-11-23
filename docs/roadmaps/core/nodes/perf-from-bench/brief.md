---
id: perf-from-bench
title: Performance work from the benchmark findings
status: done
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
verify: pnpm -C benchmarks/harness test
exclusive: [bench]
fulfilled_by:
gate: false
added: 2026-11-21
spent: 190000
owns:
  - benchmarks/README.md
shared: []
reserves: []
provides: []
depends_on:
  - on: text-anchor
    kind: hard
    why: the final run measures every perf node
  - on: fix-for-prop-each
    kind: hard
    why: the final run measures the fixed list code
  - on: bench-brumate-latest
    kind: hard
    why: works from the "Where idlip loses" list of the todos run
  - on: bench-rows
    kind: hard
    why: works from the rendering numbers
  - on: perf-list-create
    kind: hard
    why: records the numbers after it
  - on: perf-list-kept
    kind: hard
    why: records the numbers after it
  - on: perf-ssr-state
    kind: hard
    why: records the numbers after it
---

# Performance work from the benchmark findings

## Goal

Close out the benchmark-driven performance work: rerun all three scenarios (todos, rows, dashboard) for every column on a quiet machine after `perf-list-create`, `perf-list-kept` and `perf-ssr-state` land, and update `benchmarks/README.md` tables and the "Where idlip loses" list.

## Context

- Refined on 2026-11-21 from the outcomes of `bench-brumate-latest` and `bench-rows`. The three perf nodes hold the work; this node records the result.
- Losses that are the cost of the design stay and get one sentence each in the README: the first click loads handler and binding chunks (1 round trip, 2 to 3 requests), so first-click latency and click to update on a cold page trail designs that load all code before `load`. Opt-in prefetch (`renderPreload`) is the answer there; give its number as a note, not in the main table.
- Not taken up as nodes (could, for later triage in `inbox.md`): dashboard client JS gzip (about 7 small chunks per widget; module helpers copied into each chunk), rows SSR markers (+31% raw, smallest in gzip).

## Acceptance

- [ ] One full run of all scenarios with commit, date, machine and load in the README.
- [ ] Each perf node's claimed gain shows in the run, or the README says it did not.
- [ ] The "Where idlip loses" list matches the run; design costs are marked as such.

## Updates 2026-11-23

- Since this brief: cloned templates (all bodies), shared helpers, preload links (first click 232 to 66 ms with links), perf-list-kept (select -47%, remove -19% script time; the row skip was unsound and moved to `row-own-reads`, 0.2), text-anchor. Measure first click with and without preload links, both labelled (the README already has a section).
- Also refresh `website/src/benchmarks.json` (the landing chart reads it; the scale run) and the share image numbers if they changed, and check the landing chart's lead and the docs `resuming.md` tables against the new numbers.
