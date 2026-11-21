---
id: errors-client
title: Errors: client swap, throwing handlers and chunk retry
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
size: M
spike: false
hypothesis:
verify: pnpm --filter idlip test -- errors && pnpm build && pnpm --filter e2e test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent: 268605
owns:
  - packages/idlip/src/client/errors.ts
  - packages/idlip/test/client/errors/**
shared:
  - packages/idlip/src/client/loader/resume.ts
  - packages/idlip/src/client/patch/patch.ts
  - packages/idlip/src/client/features.ts
  - packages/idlip/src/vite/features.ts
  - packages/idlip/src/core/format.ts
  - packages/idlip/src/client/index.ts
reserves: []
provides: []
depends_on:
  - on: errors
    kind: behavior
    via: compiled-format
  - on: loader-trim
    kind: hard
    why: loader budget: this node adds loader seams, so it starts after the flag-off seams are trimmed
---

# Errors: client swap, throwing handlers and chunk retry

## Goal

The runtime half of `<Try>`. When a binding or a subscription source inside a region throws, swap the region for its catch view and keep the model. `reset` renders the body again from the current model. A handler that throws keeps the model and fires `idlip:error`. A chunk that fails to load is retried once, then fires `idlip:error`.

## Context

- Source: `docs/proposals/0004-effects-refs-errors.md`, Error boundaries. The region marker and `fallback` come from `compiled-format-errors.change-request.md` (node `errors`).
- Hooks that exist: `report` in `resume()` (`runTask` already reports a failed task chunk through `host.report` and keeps the step's model, so hang the swap on `report`, not a new path); `patch()` in `src/client/patch/patch.ts` runs bindings; `setBranch` and the block hook (`onBlock`) in `src/client/patch/`.
- `load` in `resume.ts` is the one place chunks are imported. The retry goes there. `deploy-skew` reuses the same failure point: this node fires `idlip:error` (a `CustomEvent` on `document`, `detail: { error, path }`) and `deploy-skew` listens. Freeze that in the change request.
- Prior art: `../brumate/packages/brumate/src/runtime/boot.ts` (boundaries) and `events.ts`.

## Loader budget

All loader code goes behind `HAS_ERRORS` (recipe: `nodes/runtime-flags/outcome.md`): `declare const` and export in `features.ts`, `ERRORS: ({ manifest }) => <some region has fallback>` in `DETECTORS`, `if (HAS_ERRORS)` around the code. The flag-off cost may be at most 15 B (the guards). Flag-on cost is reported, not capped; expect 300 to 500 B. The retry and `idlip:error` for a throwing handler are loader code too: gate the part only `<Try>` apps need, and put the rest behind the same flag unless the retry is under 40 B. Report both numbers.

## Acceptance

- [x] A binding that throws inside a `<Try>` swaps in the catch view; the model is unchanged (test with the real loader and patcher).
- [x] `reset` renders the body from the current model.
- [x] A throwing handler keeps the model and fires `idlip:error` once.
- [x] A chunk that fails once and then loads works; one that fails twice fires `idlip:error` once.
- [x] The todo build loader grows by at most 15 B over the `loader-trim` result (e2e budget test).
- [x] Fast check passes: `pnpm --filter idlip test`
- [x] Change request: `contracts/compiled-format-errors-client.change-request.md` (`idlip:error` shape, retry rule).

## Sizing

Touches the hot loader file and the patcher, with a flag. Scores: coupling medium.

## Notes for the worker

- Use one explicit state for a region (`'body' | 'catch'`), not a flag pair. Read it from the DOM markers; do not diff inputs.
- A source that throws inside a region is stopped through the same block hook as a removed block.

Landed as 1eb9d7c on `batch/core` after one fresh review round. Flags `HAS_ERRORS` and `HAS_RETRY` (separate, `deploy-skew` reuses the retry). Flag off +0 B; both on +606 B. `idlip/testing` `settled()` rethrows caught errors unless `expectCaught: true`.
