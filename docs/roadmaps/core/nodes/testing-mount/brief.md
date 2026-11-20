---
id: testing-mount
title: `idlip/testing`: render on the server and resume in happy-dom
status: todo
priority: must
type: feature
story:
early: false
outline: true
milestone: todo-resumes
target:
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-20
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on:
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

After each message, `mount` can re-render the view on the server from the new model and compare it with the patched DOM. A mismatch is a stale binding, for example from a helper with a hidden dependency. Source: `debate/debate.md`.
