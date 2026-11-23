---
id: stream-model
title: Stream model data that the server resolves after the first flush
status: todo
priority: must
type: feature
story:
early: false
outline: false
milestone: '0.2'
target:
ship: auto
land: auto
from:
size: L
spike: false
hypothesis:
verify: pnpm --filter idlip build && pnpm --filter idlip test
exclusive: [benchmark]
fulfilled_by:
gate: false
added: 2026-11-23
spent:
owns:
  - packages/idlip/src/server/**
  - packages/idlip/test/server/**
shared:
  - packages/idlip/src/compiler/**
  - packages/idlip/src/client/**
  - packages/idlip/src/core/**
  - packages/idlip/src/vite/features.ts
  - packages/idlip/test/**
  - website/docs/**
  - examples/**
  - e2e/**
  - docs/roadmaps/core/contracts/**
reserves: []
provides: []
depends_on:
  - on: render-stream
    kind: hard
    why: appends chunks to its stream
---

# Stream model data that the server resolves after the first flush

User request (2026-11-23). Today props and the model are plain data, serialized once into `<script i-state>` with seroval. A page whose data is slow waits for all of it.

Goal: props may hold promises. The server flushes the page with what is ready, shows a fallback where the view reads pending data, and streams each value into the page when it resolves. The browser resumes with the streamed values in the model, still running no component code until an event.

Read first: brumate `website/docs/async-data.md` (`#loading`, named memos, fallback behavior) and `website/docs/page-format.md`, and how brumate streams values with seroval (`crossSerializeStream` or its own format). Then idlip's `server/render.ts` (seroval use) and `contracts/compiled-format.md` (state script).

## Design first (change requests before code)

- **How the view marks pending data.** TSX only and no compile-time marker APIs (user rules): prefer a block component in the family of `<Try>`/`<For>` (for example a boundary with a fallback), or a value the view reads as an explicit union. No implicit state machines: the pending, ready and failed states of a value are one explicit union, not flags.
- **What the model holds** before and after the value arrives, and what an event that fires while a value is pending sees.
- **Wire format**: chunks appended after the state script that patch the model and swap the fallback for the rendered body, and how the loader takes them (loader budget 4096 B gzip, about 4087 B now: put it behind a `HAS_*` flag, and find savings first if the flag-off loader grows).
- Rejected promises: render through the nearest `<Try>`.

## Acceptance

- An example page with one slow value: the head and fallback arrive first, the value streams in, and a click before and after it arrives behaves as designed (e2e).
- Differential test covers a resolved stream (server and client agree after the stream ends).
- Docs page for async data; loader size with the flag off unchanged.
