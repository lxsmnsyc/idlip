---
id: jsx-types
title: JSX types for intrinsic elements and events
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

# JSX types for intrinsic elements and events

## Goal

`idlip/jsx-runtime` types: intrinsic elements whose `on:*` props take a function of the element's event (`EventProp` from `contracts/core-api.md`), so `e.currentTarget` has the element's type. Attributes `ref`, `html` (`TrustedHtml` only) and `key`. `latest:*` props with the same types as `on:*`. `<window>` and `<document>` intrinsic elements with only `on:*` and `latest:*` props (`debates/subscriptions/debate.md`). Conditions are plain JSX ternaries and `&&`, so there is no `Show`, `Switch` or `Match`. The compiler, not the types, restricts event props to handler calls.

## Context

- Source: `docs/proposals/0001-dsl.md`, View rules table, and `docs/proposals/0002-modules.md`, Example and Rules.
- Core types: `contracts/core-api.md`.

## Acceptance

- [ ] Type tests: `on:click={add}` and `on:input={(e) => setDraft(e.currentTarget.value)}` compile; `e.currentTarget.checked` on a `<button>` fails; `html="<b>"` fails and `html={trusted('<b>')}` compiles.
- [ ] Fast check passes: `pnpm --filter idlip test`

## Sizing

M: type-level work, verified by type tests.
