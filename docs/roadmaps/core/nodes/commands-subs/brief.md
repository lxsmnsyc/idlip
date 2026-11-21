---
id: commands-subs
title: <Subscribe> blocks
status: todo
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
verify: pnpm --filter idlip exec vitest run test/client/subs test/compiler/view/codegen/subscribe.test.ts
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - packages/idlip/src/compiler/view/codegen/subscribe.ts
  - packages/idlip/src/client/subs/**
  - packages/idlip/test/client/subs/**
  - packages/idlip/test/compiler/view/codegen/subscribe.test.ts
shared:
  - packages/idlip/src/compiler/view/codegen/plan.ts
  - packages/idlip/src/compiler/view/codegen/html.ts
  - packages/idlip/src/compiler/view/codegen/chunks.ts
  - packages/idlip/src/compiler/view/codegen/index.ts
  - packages/idlip/src/client/index.ts
  - packages/idlip/src/client/loader/resume.ts
  - packages/idlip/src/core/format.ts
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
  - on: stock-sources
    kind: contract
    via: core-api
---

# <Subscribe> blocks

## Goal

`<Subscribe to={source} input={...} on:value={handler}>` as settled in `debates/subscriptions/debate.md` items 3 to 9. Codegen emits a source chunk, a server marker and a restart on key change. The runtime starts a subscription on resume and on block add, and stops it on remove: stop aborts the signal, calls `return()` unawaited and drops later yields. Delivery is pull-based: the next value arrives only after the previous message is patched. Dev warns when `return()` is not settled 1000 ms after abort.

## Context

- Source: `docs/proposals/0004-effects-refs-errors.md`, Subscriptions. Analysis already emits subscribe nodes; codegen reports them codegen-unsupported today.
- Change request `contracts/compiled-format-subscribe.change-request.md`: Manifest and Chunk URLs get a `source=<name>` kind; DOM encoding and Reserved get an `i-sub` marker (input as JSON like event payloads, `on:value` as DomMessage `["$event"]`); Interface: `QueuedEvent` gains a `done` callback called after its batch is patched, so the source runtime pushes to `boot.q`.
- A source chunk that imports idlip must not cost a third request; check the Vite build.
- Source errors go to `console.error` until `errors` registers.
- `resume.ts` is shared with other nodes; keep the edit small.

## Acceptance

- [ ] The 0004 Clock example starts, ticks and stops in happy-dom, and no handler runs after its block is removed.
- [ ] A slow handler never has two values in flight.
- [ ] A server page with a running clock resumes and ticks without an event.
- [ ] A page with no `<Subscribe>` loads no source chunk.
- [ ] A changed key stops the old run and starts a new one; `<For>` rows start and stop on their own.
- [ ] The loader budget holds.
- [ ] Fast check passes: `pnpm --filter idlip exec vitest run test/client/subs test/compiler/view/codegen/subscribe.test.ts`

## Sizing

Touches codegen, loader and a format change request; many shared files, one feature.

## Updates after wave 7

- `stock-sources` landed `timer`, `socket`, `eventSource` and `media` in `src/sources/`, and `Random`, `Time` and `until` in `src/core/`. Names and types are in `contracts/core-api.md` v10. Build on the `listen` bridge in `src/sources/channel.ts`, so abort ends a source without an awaited `return()`. Do not write another stock source.
- Put the loader code behind a `HAS_<NAME>` flag (`HAS_SUBS`), following the recipe in `nodes/runtime-flags/outcome.md`: a `declare const` and export in `src/client/features.ts`, one line in `DETECTORS` of `src/vite/features.ts`, and `if (HAS_SUBS)` around the code. The 4096 B gzip budget is the loader with no optional features, so the flag removes your cost from apps that do not use it. Report the feature's cost; it is not capped. The detector is on when a manifest has a source chunk or a view has `i-sub`. Replace "The loader budget holds" with: the loader with no optional features stays within 4096 B gzip, and the app that uses subscriptions reports its cost.
- `resume.ts` changed: `apply` runs tasks through `runTask(host, task)`. A subscription value is pushed to `boot.q` the way a settled custom task is (an event with no DOM target); read `src/client/tasks/run.ts` for that path.
