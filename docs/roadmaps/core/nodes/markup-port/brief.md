---
id: markup-port
title: Port every view module to the markup DSL
status: todo
priority: should
type: refactor
story: markup-frontend
early: false
outline: false
milestone: apps
target:
ship: auto
land: auto
from:
size: L
spike: false
hypothesis:
verify: pnpm build && pnpm test && pnpm --filter e2e test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - examples/**
  - packages/idlip/test/**
  - benchmarks/idlip/**
  - e2e/**
shared:
  - packages/idlip/src/compiler/markup/**
reserves: []
provides: []
depends_on:
  - on: markup-example
    kind: hard
    why: builds on the DSL compiler and tooling on the story branch
---

# Port every view module to the markup DSL

## Goal

The framework has one source syntax: the markup DSL. A second input language means two front ends to keep in step, which the user rejects ("we can't have two compilers in the same framework"). This node moves every `*.idlip.tsx` module to `*.idlip`, so the next node can remove the TSX input path.

First merge `batch/core` into the story branch: the batch carries the features built after the story was cut (nesting, `<Subscribe>`, `<Try>`, `<Head>`, refs, forms, raw HTML, SVG, dynamic holes, effects), and their fixtures are `.idlip.tsx`. Resolve conflicts, then port: `examples/*` (todo, counters, counters-subs; `examples/todo-idlip` merges into `examples/todo`), the test fixtures under `packages/idlip/test/**`, `benchmarks/idlip`, and the e2e apps. Goldens may change only where the lowering differs; explain each.

Where the DSL cannot express something a fixture needs (for example `<Subscribe>`, `<Try>`, `<Head>`, refs, `html={trusted(...)}`, `<svg>`, message props on children, `on:submit` form fields), extend the grammar in this node: write `contracts/markup-grammar.change-request.md`, add the block or attribute to the parser and the lowering, and test it. List every gap found in the outcome.

## Acceptance

- [ ] `batch/core` is merged into `feat/markup-frontend`.
- [ ] No `*.idlip.tsx` file is left outside `docs/` history folders (spikes and prototypes stay).
- [ ] `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test && pnpm --filter e2e test` pass, with the same e2e request sets as before.
- [ ] Every DSL gap found is fixed in the grammar or listed as a blocker.

## Sizing

L: mechanical port of about 40 modules plus grammar gaps; one worker, the files are disjoint from other open work.
