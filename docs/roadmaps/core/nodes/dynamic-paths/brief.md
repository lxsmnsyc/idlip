---
id: dynamic-paths
title: Runtime path tracking for dynamic holes
status: done
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
verify: pnpm --filter idlip test -- dynamic
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-20
spent: 363165
owns:
  - packages/idlip/src/client/dynamic.ts
  - packages/idlip/src/server/dynamic.ts
  - packages/idlip/src/compiler/view/codegen/dynamic.ts
  - packages/idlip/test/dynamic/**
  - packages/idlip/test/fixtures/dynamic/**
shared:
  - packages/idlip/src/compiler/view/analyze/analyze.ts
  - packages/idlip/src/compiler/view/codegen/plan.ts
  - packages/idlip/src/core/format.ts
  - packages/idlip/src/client/patch/patch.ts
  - packages/idlip/src/client/features.ts
  - packages/idlip/src/vite/features.ts
  - packages/idlip/src/server/render.ts
reserves: []
provides: []
depends_on:
  - on: compiled-format
    kind: contract
    via: compiled-format
  - on: keyed-paths
    kind: behavior
    via: compiled-format
  - on: loader-trim
    kind: hard
    why: loader budget: this node adds loader seams, so it starts after the flag-off seams are trimmed
---

# Runtime path tracking for dynamic holes

## Goal

Replace the `hole-dynamic` compile error (`analyze.ts:1100`, `plan.ts:134`) with the runtime fallback of `docs/proposals/0002-modules.md`, Path tracking: the server evaluates the hole with a model proxy that records reads and writes the paths into `PageState.dynamic`; after each patch the client evaluates the hole again and stores the new paths.

## Context

- The analyzer never produces `dynamic` for the closed grammar (`contracts/view-ir.md`). So this node first decides which constructs now yield `dynamic` instead of an error: start with a hole that passes the whole model to a helper, and aliases of `model`. Name them in the change request and add each as a rule id change.
- A dynamic hole cannot be a static binding chunk: its group key is not known at build time. Decide where its code lives (a `binding=dynamic` chunk that evaluates all dynamic holes of the component is the simplest) and how `diffPaths` sees its stored paths.
- `compiled-format` reserves a `dynamic` field in `PageState`.
- The proxy must not run in the loader unless a page has a dynamic hole.

## Loader budget

Behind `HAS_DYNAMIC` (detector: a manifest or state record names a dynamic hole). Flag-off cost at most 20 B. Flag-on cost reported; the proxy lives in a chunk, not the loader, when it can: only the "re-evaluate after patch and store paths" hook is loader code.

## Acceptance

- [x] A fixture with a dynamic hole renders on the server with `dynamic` paths in the state script.
- [x] After a handler changes a path the hole read, only that hole patches; after the hole's reads change, the next patch uses the new paths.
- [x] A module with no dynamic hole compiles to identical output (todo goldens unchanged) and the todo loader grows by at most 20 B.
- [x] Fast check passes: `pnpm --filter idlip test`
- [x] Change request: `contracts/compiled-format-dynamic.change-request.md` and `contracts/view-ir-dynamic.change-request.md`.

## Sizing

Compiler, server and client; sized M by splitting the grammar choice to the smallest two constructs.

## Notes for the worker

- Proxy reads must record keyed paths in the same form as `keyed-paths` (`todos[id=selected]`) or fall back to `*`.
- Ask the orchestrator before widening the grammar beyond the two constructs above.

## Orchestrator decision (one-shot run)

Use the two proposed sources of `dynamic` holes: whole-model helper calls and aliases of the model. The user can revisit.

Landed as 439a849 on `batch/core` after one fresh review round (static fallback inside rows, blocks and children; `$dynamic` preloaded with handlers; `has`/`ownKeys` traps). Flag off +0 B, on +117 B. Limit: object-keyed records grow `PageState.dynamic` with key count.
