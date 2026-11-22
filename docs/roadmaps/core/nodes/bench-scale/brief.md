---
id: bench-scale
title: Measure how startup cost grows with app size
status: todo
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
verify: pnpm -C benchmarks/harness test
exclusive: [benchmark]
fulfilled_by:
gate: false
added: 2026-11-22
spent:
owns:
  - benchmarks/harness/**
  - benchmarks/*/scale/**
  - benchmarks/README.md
  - website/src/benchmarks.json
shared:
  - pnpm-lock.yaml
reserves: []
provides: []
depends_on:
  - on: bench-rows
    kind: hard
    why: extends the harness and the apps that bench-rows added
---

# Measure how startup cost grows with app size

## Goal

The landing page claims "Your app grows. Its startup doesn't." It rests on two points: the todo app and the 50-widget dashboard. Test the claim across app sizes. Then feed the landing chart, or show the claim does not hold.

## Scenario

A `scale` scenario: one generated page per size with **N distinct widget components**, for N = 10, 50, 200 and 1,000. They must be distinct component modules, not N copies of one, because resumability's claim is about code size. Each widget has a little state and one or two handlers, in the style of the dashboard widgets. Write one generator per framework (idlip, brumate 0.8.1, Marko 6, Qwik 2) that writes the source into `benchmarks/<framework>/scale/` at build time. Do not commit the generated code.

Measure per framework and size:

- JS loaded before the first click, raw and gzip -9;
- HTML, raw and gzip -9 (idlip's state script grows with the app; report it, don't hide it);
- total bytes before the first click (HTML + JS, gzip);
- main-thread script time from navigation to `load` with 4x CPU throttling, median of 10 runs. This one is a timing, so it needs perf-pass `bench.py` noise rules and a load average under about 3. Bytes are exact and can be measured at any load.

## Steps

- [ ] Generators and the `scale` scenario in the harness, with a test that each generated app builds and serves at N = 10.
- [ ] Run all four sizes. Record the load average next to timings.
- [ ] Add a "Scale" section to `benchmarks/README.md` with the tables and the method.
- [ ] Update `website/src/benchmarks.json`: make the headline group one metric per size ("10 widgets" ... "1,000 widgets", with `label`), using the metric the claim holds for. If JS on load stays flat for idlip but total bytes do not, say so in the README and use JS on load. If neither stays flat, set `headline` to the closest honest group, and say in `outcome.md` that the landing claim must change.

## Acceptance

- [ ] Four sizes for every framework that builds at that size. A framework that fails a size is reported as such, with the error.
- [ ] `outcome.md` answers yes or no: does idlip's startup stay flat while the others grow? Give numbers for bytes and for script time.
- [ ] `pnpm -C benchmarks/harness test`, `pnpm --filter website test` and `pnpm format:check` pass.

## Notes for the worker

- Read `benchmarks/README.md` and the dashboard scenario first. Reuse its serving and measuring code.
- Free ports only. Stop servers by PID. Never use pkill patterns.
