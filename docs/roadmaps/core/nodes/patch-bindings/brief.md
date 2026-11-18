---
id: patch-bindings
title: Model path diff and binding patcher
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
verify: pnpm --filter idlip exec vitest run test/client/patch
exclusive: []
fulfilled_by:
gate: false
added:
spent:
owns:
  - packages/idlip/src/client/patch/**
  - packages/idlip/test/client/patch/**
shared: []
reserves: []
provides: []
depends_on:
  - on: compiled-format
    kind: contract
    via: compiled-format
---

# Model path diff and binding patcher

## Goal

Given the old model, the new model and the manifest, find the binding groups whose model paths changed (reference comparison along each path), load their chunks, and patch text, attributes, classes and `<Show>` blocks.

## Context

- Format: `contracts/compiled-format.md`. Fixtures: `packages/idlip/test/fixtures/*/`.
- This node owns `patch()` and `diffPaths`. For a `<For>` block, `patch()` calls `patchList` through the contract interface. `patch-lists` implements it. Use a stub until it lands.

## Acceptance

- [ ] Changing `draft` in the todo fixture loads only the binding group that reads `draft`.
- [ ] A property test (fast-check) shows the changed-path set is exactly the set of paths whose values differ, for random model pairs.
- [ ] Fast check passes: `pnpm --filter idlip test`

## Sizing

M: path diff logic needs a property test. `fast-check` is installed by `core-api`.
