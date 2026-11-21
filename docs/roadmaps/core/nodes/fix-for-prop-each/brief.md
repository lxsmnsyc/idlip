---
id: fix-for-prop-each
title: Update row holes that read outer state when each is a prop
status: todo
priority: should
type: fix
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
verify: pnpm --filter idlip test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - packages/idlip/src/compiler/view/**
  - packages/idlip/test/compiler/view/**
  - packages/idlip/test/client/list/for-prop-each.test.ts
shared: []
reserves: []
provides: []
depends_on:
  - on: perf-list-kept
    kind: hard
    why: a client-side fix would touch src/client/list, which perf-list-kept owns; the compiler fix can start earlier if the proof places the bug there
---

# Update row holes that read outer state when each is a prop

## Goal

A hole inside a `<For>` row that reads component state updates when that state changes, also when `each` is a prop.

## Context

- Found by `docs-platform` (its outcome): `<For each={props.items} key="id">{(item) => <li data-r={big ? 4 : 2}>…</li>}</For>` with `let big` toggled by a handler. `mount` from `idlip/testing` fails with `attribute data-r is "2" in the page and "4" in the server render`. With `let items = props.items` and `each={items}` it updates.
- Find first whether the compiler (row binding paths for a props-rooted list) or the client list patcher drops it. If the cause is in `src/client/list/**`, wait for `perf-list-kept`.

## Acceptance

- [ ] A test that fails on `batch/core` first (the repro above), then passes.
- [ ] `pnpm --filter idlip test` and `pnpm --filter e2e test` pass.
