---
id: perf-from-bench
title: Performance work from the benchmark findings
status: todo
priority: should
type: refactor
story:
early: false
outline: true
milestone: 0.1
target:
ship: auto
land: auto
from:
size: L
spike: false
hypothesis:
verify:
exclusive: [bench]
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: bench-brumate-latest
    kind: hard
    why: works from the "Where idlip loses" list of the todos run
  - on: bench-rows
    kind: hard
    why: works from the rendering numbers
---

# Performance work from the benchmark findings

## Goal

Close the gaps the benchmarks show before 0.1, with measured gains. Known from the `benchmarks` outcome: SSR renders/s at 3 todos is about 61k against 140k for Marko, SSR HTML is 4.6 kB against 1.2 kB, and the cold first click takes 2 round trips. Refine into one node per gap once `bench-brumate-latest` and `bench-rows` report, each run with the perf-pass skill (baseline, change, `bench.py`, keep only gains above noise). A gap that is the cost of the design (resumability round trips) gets a sentence in the README instead of a node.
