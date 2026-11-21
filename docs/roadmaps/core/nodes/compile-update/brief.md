---
id: compile-update
title: Compiler: compile handler functions into update chunks
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

# Compiler: compile handler functions into update chunks

## Goal

An oxc pass that compiles each handler, a function declaration in a component body (`docs/proposals/0002-modules.md`), into an update function over the model. Reads of state become model reads, assignments to state build the next model, and calls to other handlers run inline. It emits one client module per handler, each with only the imports that handler uses. In-place mutation of state is an error with a rule id. Async handlers are split later by `custom-effects`; until then an `await` in a handler is an error.

## Context

- Output shape: `contracts/compiled-format.md`. Expected output: `packages/idlip/test/fixtures/*/`.
- Its dependencies are installed by `core-api`. Do not edit `packages/idlip/package.json`.

## Acceptance

- [ ] For both fixtures, the emitted handler modules match the expected chunks.
- [ ] A handler that calls a module-level helper gets the helper in its chunk; an unused helper is left out.
- [ ] A handler that reads a prop gets it as a payload field, and a handler that calls another handler runs both in one message.
- [ ] Fast check passes: `pnpm --filter idlip test`
