---
id: global-events
title: Dev warning for deep event queues, and window and document events
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
verify: pnpm --filter idlip exec vitest run test/client/global
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent: 84385
owns:
  - packages/idlip/src/core/dev.ts
  - packages/idlip/test/client/global/**
shared:
  - packages/idlip/src/client/loader/resume.ts
reserves: []
provides: []
depends_on:
  - on: runtime-flags
    kind: hard
    why: loader code goes behind a flag in src/client/features.ts, to keep the loader budget
  - on: compiled-format
    kind: contract
    via: compiled-format
  - on: core-api
    kind: contract
    via: core-api
---

# Dev warning for deep event queues, and window and document events

## Goal

Add a dev-only warning when one element's pending queue for one event name grows deep (`docs/proposals/0004-effects-refs-errors.md`, Window and document events). `<window>`, `<document>` and `latest:` already work end to end; prove them with tests through the real compiler and loader.

## Context

- Mount through `idlip/testing`. Keep the change in `resume.ts` to a few lines in the enqueue path.
- The dev flag is this node's choice: pick the one Vite replaces in a dependency build and prove it with a build test. brumate reads NODE_ENV (`../brumate/packages/brumate/src/runtime/rate-limit.ts`).
- `resume.ts` is also edited by `commands-subs`, `nesting-runtime`, `write-sets` and `custom-effects`. Keep the edit small and rebase on the batch.

## Acceptance

- [x] `dev.ts` exports a dev flag that the production loader drops. The production loader stays at or under 4096 B gzip.
- [x] `<window on:keydown>` inside a condition stops getting keydown after the branch is removed.
- [x] `latest:pointermove` with a gated chunk delivers only the last event; a queued `on:input` keeps every value.
- [x] In a dev build, 20 queued events for one element and type warn once and name the event. A production build holds no warning text.
- [x] Fast check passes: `pnpm --filter idlip exec vitest run test/client/global`

## Sizing

Small: one dev module, a few lines in the loader, tests over existing behavior.

## Updates after wave 7

- The Vite plugin already replaces `__IDLIP_HAS_*__` globals (`runtime-flags`). A dev flag is a different kind: it must be on in dev and off in a production build, whatever the app uses. Choose between `NODE_ENV` and a `DETECTORS` entry that depends on the build mode, and prove it with a build test as the brief says. Do not add a flag that depends on the manifest.
- The budget is the loader with no optional features, so a production build with no warning text is the case to measure.

Landed as e8b1f84 on `batch/core` after self-review. Vite replaces `process.env.NODE_ENV` in dev and build; a dev-server test covers it. Loader 3913 B gzip.
