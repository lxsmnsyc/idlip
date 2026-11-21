---
id: row-list-exports
title: Compiler: export list bindings from row group chunks
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
verify: pnpm --filter idlip exec vitest run test/compiler/view/codegen
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - packages/idlip/src/compiler/view/codegen/**
  - packages/idlip/test/compiler/view/codegen/**
shared: []
reserves: []
provides: []
depends_on:
  - on: compile-view-codegen
    kind: hard
    why: changes the chunk emission that node wrote
  - on: compile-integration
    kind: hard
    why: touches codegen files that node edited
---

# Compiler: export list bindings from row group chunks

## Goal

`compiled-format` v9 now says a binding chunk that holds a row binding of list L also exports L's `l` binding, and those of the enclosing lists up to the outermost (`contracts/compiled-format-patch-lists.change-request.md`). Without it, `class={selected === t.id}` never updates when only `selected` changes. Codegen emits chunks without those exports today.

## Acceptance

- [ ] A test that fails on the current batch: a view with `<For each={todos} key="id">` and `class={selected === t.id}` compiles to a row group chunk that exports both the row binding and the list's `l`.
- [ ] Nested lists export every enclosing `l`.
- [ ] The golden fixtures are unchanged, or the change is explained.
