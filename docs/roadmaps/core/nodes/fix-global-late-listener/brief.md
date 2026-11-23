---
id: fix-global-late-listener
title: Listen for window and document events added by a patch
status: done
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
spent: 230000
owns:
  - packages/idlip/src/client/loader/listener.ts
  - packages/idlip/test/client/global/**
shared:
  - packages/idlip/src/client/CLAUDE.md
reserves: []
provides: []
depends_on:
  - on: perf-ssr-state
    kind: hard
    why: perf-ssr-state owns src/client/loader/** while it runs
---

# Listen for window and document events added by a patch

## Goal

A `<window>` or `<document>` element whose event type was not on the page at load gets its listener when a patch adds it.

## Context

- Found by `docs-effects` (see its outcome): with `{open && <window on:keydown={press} />}` and `open = false` at load, setting `open = true` and dispatching `keydown` leaves the count at 0 under `mount` from `idlip/testing`.
- Cause: the early listener in `packages/idlip/src/client/loader/listener.ts` adds window and document listeners only in `add()`, which runs when a state record is pushed. A patch that inserts a global element never calls it.
- `website/docs/global-events.md` documents this as a limit with a workaround. Remove that limit from the page in the same change (one-line edit allowed).

## Acceptance

- [ ] A test that fails on `batch/core` first (the repro above), then passes.
- [ ] `pnpm --filter idlip test` and `pnpm --filter e2e test` pass; the todo loader stays under 4096 B gzip, cost noted.
