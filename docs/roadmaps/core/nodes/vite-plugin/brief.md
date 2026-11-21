---
id: vite-plugin
title: Vite plugin: compile, split chunks, serve SSR in dev
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
size: L
spike: false
hypothesis:
verify: pnpm --filter idlip exec vitest run test/vite
exclusive: []
fulfilled_by:
gate: false
added:
spent: 300374
owns:
  - packages/idlip/src/vite/**
  - packages/idlip/test/vite/**
shared: []
reserves: []
provides: []
depends_on:
  - on: compiled-format
    kind: contract
    via: compiled-format
  - on: spike-chunk-split
    kind: hard
    why: the spike decides the virtual module scheme this node implements
  - on: compile-integration
    kind: behavior
    via: compiled-format
  - on: ssr-render
    kind: behavior
    via: compiled-format
---

# Vite plugin: compile, split chunks, serve SSR in dev

## Goal

`idlip/vite`: compile idlip modules with `idlip/compiler`, emit one chunk per update handler and binding group, give the server renderer the chunk URLs in dev and build, and serve server-rendered pages in `vite dev`.

## Context

- Scheme: `nodes/spike-chunk-split/outcome.md`. Format: `contracts/compiled-format.md`.
- Its dependencies are installed by `core-api`. Do not edit `packages/idlip/package.json`.

## Acceptance

- [ ] `vite build` of the todo fixture app emits the chunk set the manifest lists.
- [ ] A test starts `vite dev` and fetches server-rendered HTML for the fixture.
- [ ] Fast check passes: `pnpm --filter idlip test`

## Sizing

L: blast radius medium, coupling high (compiler, server renderer, bundler).

Landed on `batch/core` as 7e5c0c3.
