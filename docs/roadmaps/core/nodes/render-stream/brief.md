---
id: render-stream
title: renderToStream, a page as a ReadableStream
status: done
priority: must
type: feature
story:
early: false
outline: false
milestone: '0.1'
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter idlip build && pnpm --filter idlip test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-23
spent: 360000
owns:
  - packages/idlip/src/server/**
  - packages/idlip/test/server/**
shared:
  - packages/idlip/src/core/format.ts
  - packages/idlip/src/vite/**
  - website/docs/reference/server.md
  - website/docs/deploying.md
  - examples/**
  - e2e/**
  - docs/roadmaps/core/contracts/**
reserves: []
provides: []
depends_on: []
---

# renderToStream, a page as a ReadableStream

User request (2026-11-23): a streaming render like brumate's. Today `render` and `renderPage` in `packages/idlip/src/server/render.ts` render synchronously and return the whole string, and the entry concatenates the document by hand.

Read first: brumate `website/docs/reference-server.md` (`renderToStream`, `render`, `streamParts`, the options table) and its implementation under `packages/brumate/src/runtime/server/`. Copy what fits; idlip has no pending-data boundary yet, so the first version streams the head as soon as it is ready and the body after it.

## Do

- User decision (2026-11-23), brumate's split: `render()` returns the parts of the first render and `pending: AsyncIterable<string>` for what resolves later (empty until `stream-model`). `renderToStream(Component, props, options?)` wraps it in a `ReadableStream<string>`, and `streamParts(result, options?)` does the same for a `render()` result.
- The first chunk is the whole first render (head, body, state), as in brumate. Cancelling the reader stops pending work.
- Nonce, preload options and the `Try` error path behave as in `renderPage`.
- Design the stream so `stream-model` can append later chunks (data that resolves after the first flush) without a format break: write the hook point in a compiled-format change request.

## Acceptance

- A test reads the stream and finds the head chunk before the body chunk; the joined stream equals `renderPage` output for the fixtures (differential test unaffected).
- Docs: `reference/server.md`, `deploying.md` (Node and Vercel pipe the stream).
- Server render throughput for the dashboard within noise of `render`.

Landed as c467a3b..b7404ea on `batch/core` after one fresh review round (cancel aborts pending work through a signal; the `head` option was dropped).
