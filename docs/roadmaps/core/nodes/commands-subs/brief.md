---
id: commands-subs
title: Built-in commands and subscriptions
status: todo
priority: should
type: feature
story:
early: false
outline: false
milestone: todo-resumes
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter idlip exec vitest run test/effects
exclusive: []
fulfilled_by:
gate: false
added:
spent:
owns:
  - packages/idlip/src/effects/**
  - packages/idlip/test/effects/**
shared:
  - packages/idlip/src/index.ts
reserves: []
provides: []
depends_on:
  - on: core-api
    kind: contract
    via: core-api
  - on: compiled-format
    kind: contract
    via: compiled-format
  - on: resume-loader
    kind: behavior
    via: compiled-format
---

# Built-in commands and subscriptions

## Goal

`Http.get`, `Storage.set`, `Focus.el` and `Time.every` as data, with their client executors loaded only when used. Active subscriptions start on resume from the list in the state script.

## Acceptance

- [ ] Each effect has a unit test in happy-dom.
- [ ] A subscription listed in the state script starts on resume without loading any update chunk.
