---
id: document-head
title: Document head
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
verify: pnpm --filter idlip test -- head
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-20
spent: 286357
owns:
  - packages/idlip/src/compiler/view/codegen/head.ts
  - packages/idlip/src/client/head.ts
  - packages/idlip/src/server/head.ts
  - packages/idlip/test/head/**
  - packages/idlip/test/fixtures/head/**
shared:
  - packages/idlip/src/core/format.ts
  - packages/idlip/src/compiler/view/codegen/index.ts
  - packages/idlip/src/compiler/view/codegen/plan.ts
  - packages/idlip/src/compiler/view/codegen/html.ts
  - packages/idlip/src/server/render.ts
  - packages/idlip/src/client/patch/blocks.ts
  - packages/idlip/src/client/features.ts
  - packages/idlip/src/vite/features.ts
reserves: []
provides: []
depends_on:
  - on: patch-bindings
    kind: behavior
    via: compiled-format
  - on: loader-trim
    kind: hard
    why: loader budget: this node adds loader seams, so it starts after the flag-off seams are trimmed
---

# Document head

## Goal

Generate and run the `head` node that the analyzer already lowers (`analyze.ts`, case `'Head'`, rule `title-outside-head` exists). `<meta>` and `<link>` go in `<head>` and are added and removed with their block; the last title wins and sets `document.title`; the server writes the last title first.

## Context

- Source: `docs/proposals/0004-effects-refs-errors.md`, Document head, with brumate's rules (`../brumate/docs/decisions.md`, `../brumate/packages/brumate/src/runtime/html.ts`).
- Server: `render` collects head output from every `<Head>` (any component, inside conditions and rows) and the host entry places it in `<head>`. Decide how `render()` returns it (a second string next to the body is the simplest) and record it in the change request; `examples/todo/src/entry-server.ts` shows the host.
- Client: a head element's text and attribute holes are ordinary bindings whose node is found in `document.head` by a marker (`i-head="<id>"` attribute). Add and remove use the block hook `onBlock` (`patch/blocks.ts`). A title change sets `document.title` from the last title in `document.head`.
- State needed: the live head blocks. Keep one explicit set of block ids; do not infer from the DOM order.

## Loader budget

Behind `HAS_HEAD` (detector: a manifest has a head entry). Flag-off cost at most 10 B. Flag-on cost reported; expect 150 to 250 B. Prefer putting element creation in the chunk for the block, so the loader holds only the add/remove registration and the title setter.

## Acceptance

- [x] The server writes the last title first in `<head>`; a nested `<Head>` in a condition adds and removes its `<meta>` on patch (happy-dom, real loader).
- [x] The last title wins after a block adds or removes one.
- [x] `<title>` outside `<Head>` is still a compile error; inside `<svg>` it is allowed.
- [x] A module with no `<Head>` compiles to identical output; the todo loader grows by at most 10 B.
- [x] Fast check passes: `pnpm --filter idlip test`
- [x] Change request: `contracts/compiled-format-head.change-request.md`.

## Sizing

Compiler, server and client, but each is small; the shared block hook already exists.

## Notes for the worker

- `testing/index.ts` renders a component into a root without a document head; extend the harness only through its public surface.

Landed as a771e78 on `batch/core` after one fresh review round. The last `<title>` in document order wins; `render()` warns in DEV when it drops head output, `renderPage()` returns `{ head, body }`; a failed `<Try>` body rolls back its head output. Flag off +0 B, flag on +307 B. Known limit: a `<Head>` in a child can rank after a later `<Head>` of its parent.
