---
id: docs-effects
title: Guide: effects, subscriptions, refs, global events
status: todo
priority: should
type: docs
story:
early: false
outline: false
milestone: 0.1
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter website check:samples && pnpm --filter website build
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - website/docs/effects.md
  - website/docs/subscriptions.md
  - website/docs/refs.md
  - website/docs/global-events.md
shared: []
reserves: []
provides: []
depends_on:
  - on: website-scaffold
    kind: hard
    why: adds Markdown pages that the scaffold's build, sidebar and sample checker process
  - on: docs-start
    kind: hard
    why: pages link to components and views, and reuse their vocabulary
  - on: custom-effects
    kind: hard
    why: documents the effect API as built
  - on: commands-subs
    kind: hard
    why: documents commands and subscriptions as built
  - on: dom-refs
    kind: hard
    why: documents refs as built
  - on: global-events
    kind: hard
    why: documents window and document listeners as built
  - on: stock-sources
    kind: hard
    why: documents the stock subscription sources as built
---

# Guide: effects, subscriptions, refs, global events

## Goal

Four pages: commands and custom effects as plain data, subscriptions (`<subscribe>`, stock sources, element subscriptions), refs and DOM commands, and `window` and `document` listeners.

## Context

- Source: `docs/proposals/0004-effects-refs-errors.md`, and the outcomes of `custom-effects`, `commands-subs`, `dom-refs`, `global-events` and `stock-sources`. Where the proposal and an outcome differ, the outcome and the code win.
- Each page shows one small DSL example that runs in `examples/` or in a test, and states what is serialized and what stays on the server.

## Acceptance

- [ ] Four pages with front matter, linked from the sidebar.
- [ ] Every sample compiles under `pnpm --filter website check:samples`; the API names match the exports in `packages/idlip/src`.
- [ ] Each page says what happens on the server, on resume, and on unmount.
- [ ] `pnpm --filter website build` and `pnpm format:check` pass.

## Sizing

M: four pages, mostly reading the outcomes. Coupling is high in dependency count but the nodes are done or active, so the context is small.

## Notes for the worker

- Document only what the code does at the time you write. If a dependency's outcome lists a stub, say so on the page or leave it out.
- Follow the plain-writing skill.
