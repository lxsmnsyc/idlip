---
id: compiled-format
title: Freeze the compiled module format with golden fixtures
status: todo
priority: must
type: contract
story:
early: false
outline: false
milestone: todo-resumes
target:
ship: auto
land: auto
from:
size: L
spike: false
hypothesis:
verify: pnpm --filter idlip exec vitest run test/fixtures
exclusive: []
fulfilled_by:
gate: true
added:
spent:
owns:
  - packages/idlip/test/fixtures/**
  - packages/idlip/src/core/format.ts
shared: []
reserves: []
provides:
  - compiled-format
depends_on:
  - on: spike-view-analysis
    kind: contract
    via: view-ir
  - on: spike-chunk-split
    kind: hard
    why: the manifest and chunk URL scheme come from the spike outcome
  - on: core-api
    kind: contract
    via: core-api
---

# Freeze the compiled module format with golden fixtures

## Goal

Define exactly what the compiler emits and what the server renderer and the client runtime consume. Write the compiled output for a counter and for the todo app by hand, as golden fixtures. The compiler and the runtime are then built in parallel against the same fixtures.

## Context

- Source: `docs/proposals/0001-dsl.md`, sections View, Patching after resume, Compiler output.
- Contract to freeze: `contracts/compiled-format.md`. Its draft lists the parts to decide.
- Read `nodes/spike-chunk-split/outcome.md` and `contracts/view-ir.md` first. The manifest follows the spike's chunk scheme, and binding groups follow the path sets the analysis computes.
- Types go in `packages/idlip/src/core/format.ts` so both sides import them.

## Steps

- [ ] Decide the DOM encoding: event attribute (`on:click='["toggle",{"id":"a1"}]'`), `$event` placeholders, binding markers (comment pairs or attributes), list item keys.
- [ ] Decide the state script: element, seroval output, where the subscription list goes.
- [ ] Decide the manifest: message tag to chunk URL, binding group to chunk URL, binding group to model path set (with `*` for list items).
- [ ] Decide the module shapes: server render function, update handler chunk export, binding chunk export, list item template chunk export.
- [ ] Decide the compiler API: `compile(source, id) => { server, client: Module[], manifest, diagnostics }`.
- [ ] Hand-write `test/fixtures/counter/` and `test/fixtures/todo/`: source `.tsx`, expected server module, expected client chunks, expected manifest, expected HTML for a given model.
- [ ] Add a fixture test that loads each fixture and checks the files parse and the manifest points at existing exports.

## Acceptance

- [ ] Both fixtures exist and the fixture test passes.
- [ ] The contract has no "TBD" left. Set `status: frozen`.
- [ ] Fast check passes: `pnpm --filter idlip test`

## Sizing

L: uncertainty high (novel format), blast radius high (every runtime and compiler node reads it).

## Notes for the worker

- The fixtures are the acceptance target for `ssr-render`, `resume-loader`, `patch-bindings`, `patch-lists`, `compile-update`, `compile-view-codegen` and `compile-integration`. Keep them small and readable.
- Design for the e2e assertion in `e2e-harness`: a click loads one update chunk and only the binding chunks whose paths changed.
