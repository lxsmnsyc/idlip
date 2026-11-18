---
id: resume-loader
title: Client event delegation, message decode and update dispatch
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
verify: pnpm --filter idlip exec vitest run test/client/loader
exclusive: []
fulfilled_by:
gate: false
added:
spent:
owns:
  - packages/idlip/src/client/index.ts
  - packages/idlip/src/client/loader/**
  - packages/idlip/test/client/loader/**
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

# Client event delegation, message decode and update dispatch

## Goal

The resume entry of `idlip/client`: one delegated listener per event type, decoding the message from the DOM (including `$event` placeholders), queueing events while chunks load, reading the model from the state script, loading the update chunk for the tag, running it, executing the returned `Cmd`, and handing old and new model to the patcher.

## Context

- Format: `contracts/compiled-format.md`. Fixtures: `packages/idlip/test/fixtures/*/`.
- The patcher is built by `patch-bindings`. Call it through the interface in the contract and use a stub in tests.

## Acceptance

- [ ] In happy-dom, a click on the counter fixture loads only the `increment` chunk and calls the patcher with the old and new model.
- [ ] Two clicks before the chunk resolves apply in order.
- [ ] `$event.value` decodes from an `input` event.
- [ ] Fast check passes: `pnpm --filter idlip test`

## Sizing

M: known pattern from Qwik and brumate, new to this repo.

## Notes for the worker

- The loader must stay small. Report its minified and gzipped size in `outcome.md`.
