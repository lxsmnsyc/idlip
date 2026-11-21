---
id: patch-lists
title: Keyed list patching for <For>
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
verify: pnpm --filter idlip exec vitest run test/client/list
exclusive: []
fulfilled_by:
gate: false
added:
spent:
owns:
  - packages/idlip/src/client/list/**
  - packages/idlip/test/client/list/**
shared: []
reserves: []
provides: []
depends_on:
  - on: compiled-format
    kind: contract
    via: compiled-format
  - on: patch-bindings
    kind: behavior
    via: compiled-format
---

# Keyed list patching for <For>

## Goal

Patch a `<For each key>` block when its list changes: insert items (render from the item template chunk), remove, move, and patch changed fields of kept items through their item bindings.

## Context

- Format: `contracts/compiled-format.md`, list blocks and item template chunks. Fixture: `packages/idlip/test/fixtures/todo/`.

- Implement `patchList` from `contracts/compiled-format.md`. `patch-bindings` calls it from `patch()`. Build against `diffPaths` from the contract and a stub until `patch-bindings` lands.

## Acceptance

- [ ] Add, remove, toggle and reorder in the todo fixture produce the DOM the server would render for the new model.
- [ ] A model test (fast-check commands: add, remove, move, toggle) compares the patched DOM with a fresh server render after every step.
- [ ] A row binding that also reads state outside the list (`class={selected === t.id}`) re-runs in every kept row when that state changes. Found by `compile-view-codegen`: `patch()` alone would not re-run it.
- [ ] Fast check passes: `pnpm --filter idlip test`

## Sizing

M: keyed reconcile is a known algorithm, the item template chunk is new.
