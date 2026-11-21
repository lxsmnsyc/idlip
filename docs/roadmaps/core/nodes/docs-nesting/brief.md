---
id: docs-nesting
title: Guide: nesting components
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
size: S
spike: false
hypothesis:
verify: pnpm --filter website check:samples && pnpm --filter website build
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - website/docs/nesting.md
shared: []
reserves: []
provides: []
depends_on:
  - on: website-scaffold
    kind: hard
    why: adds a Markdown page that the scaffold's build, sidebar and sample checker process
  - on: docs-start
    kind: hard
    why: the page builds on components and views
  - on: nesting
    kind: hard
    why: documents props, child components and their message routing as built
  - on: nesting-format
    kind: hard
    why: documents what the compiled format keeps per child
---

# Guide: nesting components

## Goal

One page on using a component inside another: props as data, how a child's messages reach its parent, and how nesting appears in the chunks the browser loads.

## Context

- Source: `docs/proposals/0002-modules.md` (nesting), outcomes of `nesting`, `nesting-compile`, `nesting-runtime` and `nesting-format`.
- Use the nested example that the `nesting` node added, if any, as the sample.

## Acceptance

- [ ] `website/docs/nesting.md` exists with front matter and a sidebar entry after `views`.
- [ ] Samples compile: `pnpm --filter website check:samples`.
- [ ] The page states the limits that the nesting outcome lists.
- [ ] `pnpm --filter website build` passes.

## Sizing

S: one page, one sample, small context.

## Notes for the worker

- Follow the plain-writing skill.

## Updates after wave 9

- The limits to state: `Step.send` (a child handler that calls a message prop) is not built, a dynamic hole inside a child binds with its static paths, a child's model is not kept after its block is removed, and on a hot remount only a child's model is kept (its props come from the fresh render).
- Nesting costs about +650 B of loader when on (`HAS_CHILDREN`). A child with no `key` outside a loop is slotted by position.
