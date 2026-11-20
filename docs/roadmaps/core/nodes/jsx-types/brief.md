---
id: jsx-types
title: JSX types that reject closures in events
status: todo
priority: must
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
verify: pnpm --filter idlip exec vitest run test/jsx
exclusive: []
fulfilled_by:
gate: false
added:
spent:
owns:
  - packages/idlip/src/jsx/**
  - packages/idlip/src/jsx-runtime/**
  - packages/idlip/test/jsx/**
shared: []
reserves: []
provides: []
depends_on:
  - on: core-api
    kind: contract
    via: core-api
---

# JSX types that reject closures in events

## Goal

`idlip/jsx-runtime` types: intrinsic elements whose `on:*` props accept only a `Message`, the `event` placeholder from `idlip`, and the `For` component. Conditions are plain JSX ternaries and `&&`, so there is no `Show`, `Switch` or `Match`.

## Context

- Source: `docs/proposals/0001-dsl.md`, View rules table, and `docs/proposals/0002-modules.md`, Event placeholder.
- Core types: `contracts/core-api.md`.

## Acceptance

- [ ] Type tests: `on:click={msg.add()}` compiles, `on:click={() => 1}` fails, `msg.setDraft(event.value)` compiles.
- [ ] Fast check passes: `pnpm --filter idlip test`

## Sizing

M: type-level work, verified by type tests.
