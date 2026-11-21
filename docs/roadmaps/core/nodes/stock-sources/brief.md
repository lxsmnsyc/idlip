---
id: stock-sources
title: Time, Random and the stock subscription sources
status: done
priority: should
type: feature
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
verify: pnpm --filter idlip exec vitest run test/sources
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent: 90381
owns:
  - packages/idlip/src/sources/**
  - packages/idlip/src/core/time.ts
  - packages/idlip/src/core/random.ts
  - packages/idlip/test/sources/**
shared:
  - packages/idlip/src/index.ts
reserves: []
provides: []
depends_on:
  - on: core-api
    kind: contract
    via: core-api
---

# Time, Random and the stock subscription sources

## Goal

Implement `Time` (`now`, `sleep(ms, signal)`), `Random` (`id`, `number`) and `until(signal, promise)` from core-api, and the stock sources timer, WebSocket, EventSource and media query. Each source is a plain async generator `(input, signal)` (0004, Subscriptions).

## Context

- `Random` and `Time` belong to this node (orchestrator decision). If `custom-effects` needs to own them, move them then.
- Source names not in core-api (timer, socket, eventSource, media): write a change request to its Interface section. No new subpath export.
- Used by `commands-subs`.

## Acceptance

- [x] `sleep` and `until` reject on abort, also when the signal is already aborted.
- [x] The timer yields only the latest tick when pulled slowly.
- [x] The socket buffer holds 100 messages and drops the oldest.
- [x] Each source closes within one task after abort, with `return()` not awaited.
- [x] The media query source yields the current value first. `tsc` checks the yielded types.
- [x] Fast check passes: `pnpm --filter idlip exec vitest run test/sources`

## Sizing

Four small generators plus two helpers, all unit tests with fakes.

Landed as 7dd92a2 on `batch/core` after self-review (two rounds).
