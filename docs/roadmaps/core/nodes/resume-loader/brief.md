---
id: resume-loader
title: Client event delegation, message decode and update dispatch
status: active
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

- [ ] `src/client/index.ts` is the loader: boot code at top level plus the helper exports binding chunks import (`vite-plugin` defaults the client input to `idlip/client` and fails the build if a chunk imports a file outside the loader's static graph). It re-exports `./patch/index.ts` from `patch-bindings` and wires `createPatch(patchList)` once `patch-lists` lands (build against a stub until then).
- [ ] The gzip size of the built loader, including `idlip/client`, is measured and reported against the 4096 B budget.
- [ ] In happy-dom, a click on the counter fixture loads only the `increment` chunk and calls the patcher with the old and new model.
- [ ] Two clicks before the chunk resolves apply in order.
- [ ] An event path placeholder (`e.currentTarget.value`) decodes from an `input` event.
- [ ] Three `input` events before the chunk resolves dispatch three messages with the three values typed, because placeholders resolve when the event fires.
- [ ] `prevent` and `stop` modifiers apply before the chunk loads. A form submit with `prevent` does not navigate.
- [ ] `focus` and `blur` messages fire through delegation.
- [ ] A chunk that fails to load keeps the queued events, reports the error, and loads again on the next event for that tag.
- [ ] Several messages queued while a chunk loads run through `update` in order, then patch once.
- [ ] Fast check passes: `pnpm --filter idlip test`

## Sizing

M: known pattern from Qwik and brumate, new to this repo.

## Notes for the worker

- Brumate's loader handles the same problems. Read `../brumate/packages/brumate/src/runtime/boot.ts` (delegation, modifiers, retry) before starting.
- The loader must stay small. Report its minified and gzipped size in `outcome.md`.
