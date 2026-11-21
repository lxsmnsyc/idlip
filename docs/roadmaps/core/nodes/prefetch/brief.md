---
id: prefetch
title: Prefetch chunks for messages present in the page
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
verify: pnpm --filter idlip test -- preload
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-20
spent: 252189
owns:
  - packages/idlip/src/server/preload.ts
  - packages/idlip/test/server/preload.test.ts
  - benchmarks/prefetch/**
shared:
  - packages/idlip/src/server/index.ts
  - packages/idlip/src/server/render.ts
  - examples/todo/src/entry-server.ts
reserves: []
provides: []
depends_on:
  - on: write-sets
    kind: behavior
    via: compiled-format
---

# Prefetch chunks for messages present in the page

## Goal

Preload the update and binding chunks that the first click is likely to need, so it does not wait on the network, and prove with a number that it helps.

## Context

- Brumate removed idle prefetch on 2026-10-25 and kept `modulepreload` links and 103 Early Hints. Read `../brumate/docs/performance.md`, Client loading, first.
- Today the first click on a todo checkbox loads `toggle` and `binding=todos.*.done` in one round trip, since `write-sets` starts the binding chunks with the handler. Prefetch removes that trip. The e2e test counts requests, so a preloaded chunk must not become an extra request: the browser must reuse the preload (same URL, `as` and crossorigin).
- Strategy to implement, server side only: `renderPreload(chunks, manifest)` returns `<link rel="modulepreload">` tags for the handler chunk of each event type present in the page and the bindings in its `writes` entry, capped at a small count (start with the handlers of events in `manifest.events` plus `click` targets visible in the markup). Offer the list for an Early Hints header through the same function.
- Measure with `benchmarks/harness` (`--scenario todos`, 150 ms RTT, see `nodes/write-sets/outcome.md` for the baseline of 209 ms cold, 1 RT). Report with and without. If it does not beat the baseline, ship the function off by default and say so in `outcome.md`.

## Loader budget

No loader code: the links are HTML. Flag-off cost 0 B, and no flag. The listener script and loader sizes must not change.

## Acceptance

- [x] `renderPreload` output for the todo manifest names only chunks of that page.
- [x] The e2e request test still passes: the first click loads `toggle` and `binding=todos.*.done` and nothing else.
- [x] A benchmark note in `outcome.md` with numbers before and after.
- [x] Fast check passes: `pnpm --filter idlip test`
- [x] Change request: `contracts/core-api-preload.change-request.md` (the new `idlip/server` export).

## Sizing

Server function plus one measured run.

## Notes for the worker

- Preloading every chunk is wrong: it defeats the "only what the click needs" goal. Keep the set to the handlers of events the page listens for.

## Orchestrator decision (one-shot run)

Measure first with the bench harness (cold first click at 150 ms RTT, baseline 209 ms). If prefetch does not beat the baseline beyond the noise, ship it off by default behind an option, and say so in the outcome.

Landed as 64b202a on `batch/core` after one fresh review round (manifest `listens` map, no HTML parse). Opt-in: cold first click at 150 ms RTT 221 ms without, 60 ms with (0 requests at the click); the load event comes about 20 ms later. Not wired into `examples/todo`.
