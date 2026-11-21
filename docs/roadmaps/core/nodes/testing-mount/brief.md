---
id: testing-mount
title: `idlip/testing`: render on the server and resume in happy-dom
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
verify: pnpm --filter idlip exec vitest run test/testing
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-20
spent: 245080
owns:
  - packages/idlip/src/testing/**
  - packages/idlip/test/testing/**
shared:
  - packages/idlip/package.json
  - packages/idlip/tsdown.config.ts
reserves: []
provides: []
depends_on:
  - on: chunk-helpers
    kind: hard
    why: chunks and the loader change shape to fit the budget
  - on: ssr-render
    kind: hard
    why: mount renders through the server renderer
  - on: resume-loader
    kind: hard
    why: mount resumes through the loader
---

# `idlip/testing`: render on the server and resume in happy-dom

## Goal

A `mount(module, model)` helper for tests: render on the server, resume in happy-dom, dispatch DOM events, and wait until chunks and patches settle. The loader's `start()` returns a `stop()` so tests can tear a page down. Brumate's version is `../brumate/packages/brumate/src/runtime/testing.ts`.

A module is a function component (`docs/proposals/0002-modules.md`), so the signature is `mount(source, props, options?)`: it compiles the `.idlip.tsx` source in memory with `compile()` from `idlip/compiler`, evaluates the server module, renders with `render()`, and serves chunks from memory to the loader.

After each message, `mount` can re-render the view on the server from the new model and compare it with the patched DOM. A mismatch is a stale binding, for example from a helper with a hidden dependency. Source: `debate/debate.md`.

## Context

- `contracts/core-api.md`, `contracts/compiled-format.md`.
- Outcomes: `compile-integration`, `ssr-render`, `resume-loader`, `patch-bindings`, `patch-lists`.

## Acceptance

- [ ] `idlip/testing` exports `mount`, added to the package exports and the build entries.
- [ ] `mount(todoSource, { initial })` renders, resumes in happy-dom, and `page.click(selector)` / `page.input(selector, value)` dispatch events; `await page.settled()` waits for chunk loads and patches.
- [ ] `page.loaded()` lists the chunk names loaded so far; the first checkbox click on the todo gives `handler=toggle` and `binding=todos.*.done`.
- [ ] With `check: true` (default in tests), each settled step re-renders on the server from the new model and fails on a DOM mismatch, naming the first differing node.
- [ ] `page.stop()` removes listeners; a click after it loads nothing.

Landed on `batch/core` as abf372c. Size M against an S estimate. Deviations: server render takes a model (codegen, format.ts, golden server.js), `resume()` returns `{ stop, settled }` with an error callback.
