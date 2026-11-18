---
id: compile-update
title: Compiler: split update handlers into chunks
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
verify: pnpm --filter idlip exec vitest run test/compiler/update
exclusive: []
fulfilled_by:
gate: false
added:
spent:
owns:
  - packages/idlip/src/compiler/update/**
  - packages/idlip/test/compiler/update/**
shared: []
reserves: []
provides: []
depends_on:
  - on: core-api
    kind: contract
    via: core-api
  - on: compiled-format
    kind: contract
    via: compiled-format
---

# Compiler: split update handlers into chunks

## Goal

An oxc pass that finds the `defineUpdate` object in a module and emits one client module per handler, each with only the imports that handler uses.

## Context

- Output shape: `contracts/compiled-format.md`. Expected output: `packages/idlip/test/fixtures/*/`.
- Its dependencies are installed by `core-api`. Do not edit `packages/idlip/package.json`.

## Acceptance

- [ ] For both fixtures, the emitted handler modules match the expected chunks.
- [ ] A handler that calls a module-level helper gets the helper in its chunk; an unused helper is left out.
- [ ] Fast check passes: `pnpm --filter idlip test`
