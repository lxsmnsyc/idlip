---
id: write-sets
title: Write sets for update handlers and parallel chunk loading
status: todo
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
verify: pnpm --filter idlip exec vitest run test/compiler/update test/client/loader test/client/patch test/fixtures
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-20
spent:
owns:
  - packages/idlip/src/compiler/update/writes.ts
  - packages/idlip/test/compiler/update/writes.test.ts
  - packages/idlip/test/client/loader/writes.test.ts
shared:
  - packages/idlip/src/compiler/update/index.ts
  - packages/idlip/src/compiler/update/handlers.ts
  - packages/idlip/src/compiler/view/codegen/index.ts
  - packages/idlip/src/client/loader/resume.ts
  - packages/idlip/src/client/patch/patch.ts
  - packages/idlip/src/core/format.ts
  - packages/idlip/test/fixtures/**
reserves: []
provides: []
depends_on:
  - on: runtime-flags
    kind: hard
    why: loader code goes behind a flag in src/client/features.ts, to keep the loader budget
  - on: compile-update
    kind: hard
    why: the write analysis reads the handler closure that handlers.ts builds and extends its exports
  - on: resume-loader
    kind: hard
    why: changes the load order inside resume.ts
---

# Write sets for update handlers and parallel chunk loading

## Goal

Each `manifest.handlers` entry gets `writes` (the model paths the handler's closure can change) and `bindings` (the group keys to preload, keeping only groups that no other listed group covers). On an event, the loader starts the handler chunk and those binding chunks together. `patch` diffs only along the write set. Old manifests without `writes` keep the current order.

## Context

- Source: `docs/proposals/0003-update-analysis.md`, Write sets. Its examples use the old spread form. In function components, a write is an assignment to a state `let`.
- The IR already has `Handler.writes` (field names). Field names alone are too coarse. For `toggle`, `todos` meets `todos.*.done`, `todos.*.id` and `todos.*.text` (`test/fixtures/todo/expected/manifest.json`), so preloading would fetch three binding chunks and break the GOAL request count. The analysis must recognize `x = x.map((t) => (<test> ? { ...t, f: <e> } : t))` as `x.*.f`. Any other write to `x` stays `x`.
- Continuation tags (`add$1`) get the writes of their whole handler. That is an upper bound.
- Change request (write it as `contracts/compiled-format-write-sets.change-request.md`):
  - Runtime seams: `Patch` becomes `(page, prev, next, writes?: readonly string[])`.
  - Patching: with `writes`, diff only the group paths that are a prefix of a write or have a write as a prefix. `*` matches any item.
  - Manifest: `writes` is a path list. `bindings` is the covers-minimal group keys.

## Acceptance

- [ ] `writes.test.ts`: `setDraft` gives `draft`; `toggle` gives `todos.*.done`; `add` gives `todos, next, draft`; a handler calling another unions both; a map that is not the pattern gives `todos`.
- [ ] The todo fixture manifest has `toggle: { chunk, writes: ["todos.*.done"], bindings: ["todos.*.done"] }`. The fixture tests pass.
- [ ] A loader test shows the `binding=todos.*.done` import starting before `handler=toggle` resolves. Within one batch, `patch` gets the union of the events' writes.
- [ ] A manifest entry without `writes` patches with a full diff.
- [ ] `pnpm build && pnpm --filter e2e test` still passes: the first toggle loads only `toggle` and `binding=todos.*.done`.
- [ ] The loader stays within 4096 B gzip (currently 3901 B).

## Sizing

M: compiler plus loader, about 8 files, known pattern.

## Notes for the worker

- `custom-effects` and `run-tasks` may edit `resume.ts`, `handlers.ts` and the codegen manifest in the same wave. Keep your logic in `writes.ts` and keep the edits to shared files small.
- Preloading a chunk that ends up unused is fine (the proposal accepts it).
- The loader has about 195 B gzip left and several nodes add loader code. Spend as little of it as you can.
