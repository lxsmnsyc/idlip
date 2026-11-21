---
id: compile-integration
title: 'Compiler: wire compile() end to end'
status: done
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
spent: 152810
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
  - on: props-method-path
    kind: hard
    why: the payload order must match between update chunks and events
  - on: analyze-v9
    kind: hard
    why: the todo source uses event modifiers, which the analysis accepts only after view-ir v9
  - on: compile-view-codegen
    kind: hard
    why: calls the real code generation
---

# Compiler: wire compile() end to end

## Goal

`compile(source, id)` from `idlip/compiler` runs the real pipeline: parse, split update handlers (`compile-update`), analyze the view (`compile-view-analyze`) and generate code (`compile-view-codegen`). It returns the server module, client modules, manifest and diagnostics that `contracts/compiled-format.md` defines.

## Acceptance

- [ ] `idlip/compiler` exports `compile()` plus the analysis, `compileHandlers` and `generate`. One component picker (first exported stateful component) is exported from `compiler/update` and used by codegen too.
- [ ] `compile()` output for both fixtures equals the golden fixtures, and `vite-plugin`'s default `compile` resolves to it.
- [ ] For both fixtures in `packages/idlip/test/fixtures/`, `compile()` on the source gives the expected output.
- [ ] Diagnostics from the analysis reach the caller with file positions.
- [ ] Fast check passes: `pnpm --filter idlip test`

## Sizing

S: glue code over three finished parts.

Landed on `batch/core` as 427f79c. Also exports `pickComponent` from `compiler/update`.
