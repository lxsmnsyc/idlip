---
id: chunk-helpers
title: Copy DOM and render helpers into chunks to fit the loader budget
status: todo
priority: must
type: perf
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
verify: pnpm --filter idlip test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - packages/idlip/src/compiler/view/codegen/**
  - packages/idlip/test/compiler/view/codegen/**
  - packages/idlip/src/core/helpers.ts
  - packages/idlip/test/core/helpers.test.ts
shared:
  - packages/idlip/src/client/patch/dom.ts
  - packages/idlip/src/client/patch/index.ts
  - packages/idlip/src/server/helpers.ts
  - packages/idlip/test/fixtures/**
reserves: []
provides: []
depends_on:
  - on: resume-loader
    kind: hard
    why: the loader's exports change, and the measured budget comes from the wired loader
  - on: row-list-exports
    kind: hard
    why: edits the same chunk emission
---

# Copy DOM and render helpers into chunks to fit the loader budget

## Goal

The `resume-loader` review measured the loader with the real patcher and list patching at 4877 B gzip, 781 B over the 4096 B budget. `compiled-format` v9 now keeps `setAttr`, `setText`, `setOn`, `setBranch`, `attr`, `on` and `text` out of the loader: the compiler copies the ones a chunk uses into that chunk, from one source.

## Evidence

`nodes/resume-loader/outcome.md` (sizes) and the review numbers: `resume` 1319 B, + patcher 3617 B, + `patchList` 4659 B, + render helpers 4877 B.

## Acceptance

- [ ] Measure first: the built loader with `createPatch(patchList)` on the current batch, gzip -9, recorded in `log.md`.
- [ ] One source for each helper (`src/core/helpers.ts` or the existing modules), copied into chunks by codegen (for example from the function source text at compile time), with a test that the copy equals the source.
- [ ] Binding, list and item template chunks import from `idlip/client` only what the loader holds; the vite-plugin loader-graph check passes on the fixture app.
- [ ] The loader is at most 4096 B gzip -9, measured the same way, and the e2e budget test passes.
- [ ] The first todo click still loads exactly `handler=toggle` and `binding=todos.*.done`; report the binding chunk's size before and after.
- [ ] Golden fixtures updated where chunk text changes, with the reason in the outcome.
