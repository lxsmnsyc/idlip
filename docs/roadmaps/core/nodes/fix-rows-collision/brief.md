---
id: fix-rows-collision
title: State names collide with server render locals
status: active
priority: should
type: fix
story:
early: false
outline: false
milestone: apps
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
  - packages/idlip/test/compiler/view/codegen/locals.test.ts
shared:
  - packages/idlip/src/compiler/view/codegen/text.ts
  - packages/idlip/src/compiler/view/codegen/html.ts
reserves: []
provides: []
depends_on:
  - on: nesting-compile
    kind: hard
    why: nesting-compile changed the reserved local names in text.ts
---

# State names collide with server render locals

## Goal

The `dom-refs` worker found that a state field named `rows` collides with the list accumulator `rows$` in the generated server render. Prove it first with a failing test on the current target, then fix it so no user name can collide with a generated local (reserve the generated names, or rename generated locals to a form user code cannot write).

## Acceptance

- [ ] A test with a state `let rows` (and other generated local names, for example `path`, `out`) compiles and renders the right HTML. It fails on the base.
- [ ] Existing fixtures unchanged, or the change is explained.

## Sizing

S: one naming rule in codegen.
