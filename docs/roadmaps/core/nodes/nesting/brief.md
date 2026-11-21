---
id: nesting
title: Nested components, end to end
status: todo
priority: should
type: feature
story:
early: false
outline: false
milestone: apps
target:
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify: pnpm --filter e2e test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - examples/counters/**
  - e2e/tests/nested.spec.ts
shared:
  - e2e/playwright.config.ts
  - pnpm-lock.yaml
reserves: []
provides: []
depends_on:
  - on: nesting-compile
    kind: hard
    why: needs the real compiler output for children
  - on: nesting-runtime
    kind: hard
    why: needs the real loader and patch code for children
---

# Nested components, end to end

## Goal

An example app with a list of `Counter` children and remove buttons, and an e2e test that counts requests.

## Context

- Child components as in `docs/proposals/0002-modules.md`, Props and nesting. Needs the real compiler output and runtime, hence the hard dependencies.

## Acceptance

- [ ] The first child click loads only child chunks.
- [ ] The DOM equals a fresh server render after each step.
- [ ] The todo e2e is unchanged.
- [ ] Fast check passes: `pnpm --filter e2e test`

## Sizing

Example app and one spec; the work is in the dependencies.

## From nesting-compile (orchestrator)

`generate(ir, source, id, { child, resolve })` takes a `child` option and a `resolve` function, but `compile()` in `src/compiler/index.ts` and the Vite plugin do not forward them yet. This node wires both, so the example builds through Vite.
