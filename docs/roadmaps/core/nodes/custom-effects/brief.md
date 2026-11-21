---
id: custom-effects
title: "Async handlers: await compiled into a task and a continuation"
status: active
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
verify: pnpm --filter idlip exec vitest run test/compiler/update test/fixtures test/vite
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-20
spent:
owns:
  - packages/idlip/src/compiler/update/segments.ts
  - packages/idlip/src/compiler/update/tasks.ts
  - packages/idlip/test/compiler/update/effects.test.ts
  - packages/idlip/test/fixtures/effects/**
shared:
  - packages/idlip/src/compiler/update/handlers.ts
  - packages/idlip/src/compiler/update/emit.ts
  - packages/idlip/src/compiler/update/index.ts
  - packages/idlip/src/compiler/view/codegen/index.ts
  - packages/idlip/src/vite/chunks.ts
  - packages/idlip/src/core/format.ts
  - packages/idlip/test/fixtures/fixtures.test.ts
reserves: []
provides: []
depends_on:
  - on: compile-update
    kind: hard
    why: replaces the handler-await error inside the existing chunk emitter
---

# Async handlers: compiler half

## Goal

Remove `handler-await`. A handler's chunk exports one function per segment (`persist`, `persist$1`, ...). A segment that ends at an `await` returns `{ model, task }`. A continuation takes `[outcome, ...carried]`, takes the `try` branch or the `catch` branch, then runs the code after the `try`. Each awaited import or module function gets a task chunk. Built-in sites (`Random.id`, `Random.number`, `Time.now`, `Time.sleep`) are copied into the handler chunk, so they load nothing. The runtime is `run-tasks`.

## Context

- Sources: `docs/proposals/0004-effects-refs-errors.md`, Effects; 0002 Rules (`await`, Concurrency); compiled-format, Handler chunks. The IR already gives `segments`, `carried` and `awaits`.
- Change request, filed first as `contracts/compiled-format-tasks.change-request.md`. The orchestrator applies it before `run-tasks` integrates.
  - `site` is the continuation tag (`persist$1`), which avoids `:` in file names.
  - Chunk `task=<site>` exports `run(...args)`. `manifest.tasks[site]` is its chunk, or the handler chunk for built-ins, which export `task$<site>`.
  - `vite/chunks.ts` accepts the `task` kind.
- Rules: an `await` of a called handler that awaits is a new error id. A rejection outside a `try` goes to `outcome.error` and the continuation rethrows it, so the loader reports it.
- `Random` and `Time` are implemented by `stock-sources`. This node only recognizes their call sites.

## Acceptance

- [ ] An `effects` fixture (the 0002 `persist` with `try`/`catch`, plus two sequential awaits with carried locals) has golden chunks, manifest and task chunk. The fixture tests pass.
- [ ] Semantics tests: state read after an `await` reads the model of that moment; carried locals arrive in order; the catch runs on `{ ok: false }`.
- [ ] The todo and counter fixtures are byte for byte unchanged.

## Sizing

M: a CPS split over top-level statements and one `try` level, in known code.

## Notes for the worker

- `write-sets` edits `handlers.ts` and the codegen manifest in the same wave. Put the splitting in `segments.ts`.
