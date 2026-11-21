---
id: example-todo
title: Todo example written in the DSL, passing the e2e tests
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
size: M
spike: false
hypothesis:
verify: pnpm --filter e2e test
exclusive: []
fulfilled_by:
gate: true
added:
spent:
owns:
  - examples/todo/**
shared:
  - e2e/playwright.config.ts
  - pnpm-lock.yaml
reserves: []
provides: []
depends_on:
  - on: chunk-helpers
    kind: hard
    why: chunks and the loader change shape to fit the budget
  - on: row-list-exports
    kind: hard
    why: the example needs the fixed chunk exports
  - on: vite-plugin
    kind: hard
    why: the example builds through the plugin
  - on: e2e-harness
    kind: hard
    why: switches the e2e tests from the fixture to this app
  - on: compile-view-analyze
    kind: hard
    why: the real compiler must analyze the example view
  - on: compile-update
    kind: hard
    why: the real compiler must split the example update
  - on: ssr-render
    kind: hard
    why: the example must render with the real server renderer
  - on: resume-loader
    kind: hard
    why: the example must resume with the real loader
  - on: patch-bindings
    kind: hard
    why: the example must patch with the real binding patcher
  - on: patch-lists
    kind: hard
    why: the todo list needs keyed list patching
  - on: compile-integration
    kind: hard
    why: the example compiles through the real compile()
  - on: jsx-types
    kind: hard
    why: the example view must typecheck with the real JSX types
---

# Todo example written in the DSL, passing the e2e tests

## Goal

`examples/todo`: the todo app from `docs/proposals/0002-modules.md`, written as a function component in `*.idlip.tsx` and built with `idlip/vite`. The e2e tests run against it instead of the fixture. This node closes the first milestone.

## Acceptance

- [ ] `pnpm --filter todo build` and `pnpm --filter todo dev` work.
- [ ] The e2e tests pass against the example.
- [ ] `outcome.md` lists the bytes loaded before and after the first click.
- [ ] The e2e harness runs it with `E2E_TARGET=example`: the package is `todo`, `pnpm --filter todo preview --port 4173 --strictPort` serves it, and `GET /?props=<json>` renders the page for `{ initial: [...] }`. Adapt `getChunkName` in `e2e/tests/support.ts` to the built file names if needed (from `e2e-harness`).

## Notes for the worker

- If the compiled output differs from the fixture, fix the compiler, not the fixture, unless the fixture is wrong. Report which.
