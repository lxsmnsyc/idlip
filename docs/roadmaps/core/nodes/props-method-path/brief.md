---
id: props-method-path
title: Compiler: stop props paths before a called method
status: todo
priority: must
type: fix
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
verify: pnpm --filter idlip exec vitest run test/compiler
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - packages/idlip/src/compiler/view/analyze/**
  - packages/idlip/test/compiler/view/analyze/**
  - packages/idlip/src/compiler/update/**
  - packages/idlip/test/compiler/update/**
shared: []
reserves: []
provides: []
depends_on:
  - on: compile-update
    kind: hard
    why: changes the payload code that node wrote
  - on: analyze-v9
    kind: hard
    why: changes the analysis code that node extended
---

# Compiler: stop props paths before a called method

## Goal

A method call on a props path in a handler, such as `props.list.indexOf(by)`, desyncs the event payload. The analysis records the path `list.indexOf`, while the update chunk reads `props$list` and appends it, so the chunk is `f(model, [props$list$indexOf, props$list, by])` and codegen sends `[<list.indexOf>, by]`: `by` arrives as `undefined`.

## Evidence

The second `compile-update` review (2026-11-21) reproduced it with a probe; see `nodes/compile-update/outcome.md`, Gotchas.

## Acceptance

- [ ] A test that fails on the current batch: a handler reading `props.list.indexOf(by)` gets payload `[props$list, by]` and computes the right value.
- [ ] The analysis stops a props path (and a state path) before a called member: `props.list.map(f)` reads `list`.
- [ ] `compileHandlers` reports an error when a chunk needs a props path that `listHandlerProps` does not list, instead of appending it.
