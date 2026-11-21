---
id: errors
title: Errors: the Try block in the compiler and on the server
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
verify: pnpm --filter idlip test -- try
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-20
spent:
owns:
  - packages/idlip/src/compiler/view/codegen/try.ts
  - packages/idlip/src/server/try.ts
  - packages/idlip/test/try/**
  - packages/idlip/test/try/**
  - packages/idlip/test/fixtures/try/**
shared:
  - packages/idlip/src/core/format.ts
  - packages/idlip/src/compiler/view/codegen/index.ts
  - packages/idlip/src/compiler/view/codegen/plan.ts
  - packages/idlip/src/compiler/view/codegen/html.ts
  - packages/idlip/src/compiler/view/codegen/text.ts
  - packages/idlip/src/server/render.ts
  - packages/idlip/src/server/index.ts
reserves: []
provides: []
depends_on:
  - on: compiled-format
    kind: contract
    via: compiled-format
---

# Errors: the Try block in the compiler and on the server

## Goal

Generate code for the `try` node that the analyzer already lowers (`analyze.ts`, case `'Try'`; view-ir `{ kind: 'try'; body; error; reset; catch }`), and render it on the server: when a hole, helper or child inside the body throws, the server renders the `catch` view in its place. The client half is the node `errors-client`.

## Context

- Source: `docs/proposals/0004-effects-refs-errors.md`, Error boundaries.
- The codegen does not handle `try` yet (`codegen/text.ts` lists it with the unsupported kinds). Decide the wire format and record it in the change request: a `Try` region is a comment pair like other blocks (compiled-format, Markers); the manifest carries `fallback` for the region (reserved by compiled-format, `Reserved fields`), which names the chunk or export that renders the catch view. The catch view is a client template like a row template, so it can be loaded on demand. It takes `error` and `reset`.
- `reset` is an event target in the IR (`reset` of a `<Try>`), so the click sends a message that the runtime handles; the compiler must emit the event record for it.
- `error` in the catch view is a local, not a model path. On the client it cannot be serialized through the state script, so the server renders the catch view with the error message only. Say in the change request what the view may read.
- Server: the render helper wraps a region in try/catch and emits the catch view in the same comment pair, so the client sees one region either way.
- No loader code here. The brief of `errors-client` owns the flag `HAS_ERRORS` and its detector (`fallback` on a region). This node adds nothing to the loader: flag-off cost 0 B.

## Acceptance

- [ ] A fixture with a `<Try>` around a hole that throws renders the catch view on the server. Golden files in `test/fixtures/try/`.
- [ ] A `<Try>` inside a condition and inside a `<For>` row renders and compiles.
- [ ] The manifest has `fallback` for each region; a module with no `<Try>` has none and its output is byte-identical to before (todo goldens unchanged).
- [ ] Fast check passes: `pnpm --filter idlip test`
- [ ] Change request: `contracts/compiled-format-errors.change-request.md` (region marker, `fallback`, `reset` message, what the catch view reads).

## Sizing

Compiler plus server only, one new block kind. The runtime half is `errors-client`.

## Notes for the worker

- Components are plain functions; the catch arrow is the only closure in the source and is compiled away. Do not serialize it.
- Brumate's `#try ... #catch` is in `../brumate/packages/brumate/src/runtime/boot.ts` and `html.ts`; read it first for how the server marks a failed region.
