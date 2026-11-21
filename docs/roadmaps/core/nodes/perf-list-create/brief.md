---
id: perf-list-create
title: Create list rows with one parse
status: done
priority: should
type: refactor
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
verify: pnpm --filter idlip test && pnpm -C benchmarks/harness bench --scenario rows --only idlip,marko --rounds 1
exclusive: [bench]
fulfilled_by:
gate: false
added: 2026-11-21
spent: 250000
owns:
  - packages/idlip/src/client/list/**
  - packages/idlip/src/client/patch/dom.ts
  - packages/idlip/src/client/patch/blocks.ts
  - packages/idlip/test/client/list/**
shared:
  - packages/idlip/src/client/CLAUDE.md
reserves: []
provides: []
depends_on:
  - on: bench-rows
    kind: hard
    why: the rows scenario is the baseline and the proof
---

# Create list rows with one parse

## Goal

New rows of a `<For>` list are parsed in one pass, not one `<template>` and `innerHTML` per row. Create, replace, append and create 10,000 rows get faster by more than the noise.

## Context

- Profiled in `nodes/bench-rows/outcome.md` ("Where idlip loses"): `patchList` (`src/client/list/index.ts`) calls `parseHtml` (`src/client/patch/dom.ts`) per new row. Of 16.5 ms script time for create 1,000 rows, `parseHtml` takes 8.1 ms; `collectBlocks` / `findInnerBlocks` (`src/client/patch/blocks.ts`) run per row too. idlip is 1.6x to 2.2x behind brumate 0.8.1 and Marko on create, replace, create 10,000 and append.
- Idea: join the HTML of all new rows of one patch into one string, parse once, then split the fragment by the row markers and collect blocks in one walk.
- Loader size counts: `src/client/CLAUDE.md` lists the flag costs and the 4096 B budget. Report the gzip change of the todo loader.

## Acceptance

- [ ] Proof on `batch/core` first: rows create, replace, append and create 10,000 with `bench.py` rules (perf-pass skill), recorded in `log.md`.
- [ ] The same operations are faster on the branch by more than the noise; numbers before and after in the outcome.
- [ ] `pnpm --filter idlip test` and `pnpm --filter e2e test` pass; the todo loader stays under 4096 B gzip.

## Notes for the worker

- Use the perf-pass skill. Keep only changes whose gain is above the noise.
- `perf-list-kept` works on the kept-row pass in the same file after you; do not change it here.
