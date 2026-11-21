---
id: benchmarks
title: Benchmarks against Qwik, Marko and brumate
status: active
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
size: M
spike: false
hypothesis:
verify: pnpm -C benchmarks/harness bench --scenario todos --only idlip,marko,qwik2 --rounds 1
exclusive: [bench]
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - benchmarks/**
shared:
  - pnpm-workspace.yaml
  - pnpm-lock.yaml
  - package.json
reserves: []
provides: []
depends_on:
  - on: example-todo
    kind: hard
    why: copies its Vite and entry-server setup
---

# Benchmarks against Qwik, Marko and brumate

## Goal

Port brumate's todos scenario (`../brumate/benchmarks`, MIT, same author): the harness plus qwik1, qwik2, marko and npm brumate apps, and an idlip app that meets the harness's expectations (its README, Adding a framework). Report JS before load, JS after counter, toggle and add, SSR size and renders per second, and the cold first click at 150 ms RTT with the round-trip count. Commit the numbers in the README with the commit and machine.

## Context

- Todos scenario only.
- Copy the Vite and entry-server setup from `example-todo`.
- `spike-chunk-merge` builds on this node.

## Acceptance

- [ ] Verify prints the todos table for all frameworks.
- [ ] Root build, test and typecheck leave `benchmarks/*` out; results are git-ignored.
- [ ] Fast check passes: `pnpm -C benchmarks/harness bench --scenario todos --only idlip,marko,qwik2 --rounds 1`

## Sizing

Several framework apps and a harness port; mostly copying, with install and build time.
