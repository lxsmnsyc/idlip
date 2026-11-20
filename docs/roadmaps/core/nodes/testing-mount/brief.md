---
id: testing-mount
title: `idlip/testing`: render on the server and resume in happy-dom
status: todo
priority: should
type: feature
story:
early: false
outline: true
milestone: apps
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
