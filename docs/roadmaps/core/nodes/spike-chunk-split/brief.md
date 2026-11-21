---
id: spike-chunk-split
title: Spike: per-handler and per-binding chunks through Vite and Rolldown
status: active
priority: must
type: spike
story:
early: false
outline: false
milestone: todo-resumes
target:
ship: auto
land: auto
from:
size: M
spike: true
hypothesis:
verify: 
exclusive: []
fulfilled_by:
gate: false
added:
spent:
owns:
  - docs/roadmaps/core/nodes/spike-chunk-split/**
shared: []
reserves: []
provides: []
depends_on: []
---

# Spike: per-handler and per-binding chunks through Vite and Rolldown

## Goal

Answer: how does a Vite plugin turn one source module into many lazily loaded chunks (one per update handler, one per binding group), and how does the server learn each chunk's URL in dev and in build?

## Context

- Source: `docs/proposals/0001-dsl.md`, Compiler output.
- Modules are `*.idlip.tsx` files with one default export (`docs/proposals/0002-modules.md`). Use that suffix for the plugin filter.
- brumate solved a similar problem. Read `../brumate/packages/brumate/src/vite.ts` and its bundle manifest code first.

## Acceptance

- [ ] A prototype plugin under this node folder splits a hand-written module into virtual chunks and logs their URLs in `vite dev` and `vite build`.
- [ ] `outcome.md` states the virtual module id scheme, how the manifest reaches the server renderer, how HMR invalidates chunks, and the chunk count for the todo fixture.

## Sizing

M with high uncertainty, time-boxed.

## Notes for the worker

- Check whether Rolldown merges tiny chunks by default and how to stop it for these entries.
