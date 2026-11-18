---
id: compile-integration
title: 'Compiler: wire compile() end to end'
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
size: S
spike: false
hypothesis:
verify: pnpm --filter idlip exec vitest run test/compiler/compile
exclusive: []
fulfilled_by:
gate: false
added:
spent:
owns:
  - packages/idlip/src/compiler/index.ts
  - packages/idlip/test/compiler/compile/**
shared: []
reserves: []
provides: []
depends_on:
  - on: compile-update
    kind: hard
    why: calls the real update splitter
  - on: compile-view-analyze
    kind: hard
    why: calls the real view analysis
  - on: compile-view-codegen
    kind: hard
    why: calls the real code generation
---

# Compiler: wire compile() end to end

## Goal

`compile(source, id)` from `idlip/compiler` runs the real pipeline: parse, split update handlers (`compile-update`), analyze the view (`compile-view-analyze`) and generate code (`compile-view-codegen`). It returns the server module, client modules, manifest and diagnostics that `contracts/compiled-format.md` defines.

## Acceptance

- [ ] For both fixtures in `packages/idlip/test/fixtures/`, `compile()` on the source gives the expected output.
- [ ] Diagnostics from the analysis reach the caller with file positions.
- [ ] Fast check passes: `pnpm --filter idlip test`

## Sizing

S: glue code over three finished parts.
