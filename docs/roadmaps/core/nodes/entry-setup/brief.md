---
id: entry-setup
title: The whole document renders from an idlip component
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
spent: 1100000
owns:
  - packages/idlip/src/vite/**
  - packages/idlip/test/vite/**
shared:
  - packages/idlip/src/server/**
  - examples/**
  - benchmarks/idlip/**
  - website/docs/**
  - website/src/demo/**
  - e2e/**
reserves: []
provides: []
depends_on:
  - on: render-stream
    kind: hard
    why: the entry returns its stream
---

# The whole document renders from an idlip component

User decision (2026-11-23): the current entry form is unacceptable. Every entry builds the document as a string (`<!doctype html>`, `<html>`, `<head>`, `renderListener()`, a loader `<script>` with `/@id/idlip/client` in dev or a URL read by hand from `.vite/manifest.json` in production) and only the body comes from idlip. The entire document must render through an idlip component, not partially.

Read first: brumate `website/docs/routing.md` (`_layout.brm` renders `<html>`, `<head>`, `<body>`; "The server adds the doctype, the head of the components and the scripts"), `page-metadata.md` (`<title>` inside a document component's `<head>`), `reference-server.md` (render options), `reference-plugin.md` (how the plugin hands client bundles to the server: `.brumate/hints.json`, `setClientBundles`), and `examples/todos/server.ts`. Then idlip's `server/render.ts`, `<Head>` (`website/docs/head.md`) and `website/docs/deploying.md`.

## Do

- User decision (2026-11-23): `render()` returns the parts of the first render plus `pending` (today's `renderPage` result), as brumate's `render` does, and `renderPage` goes away. Update every caller.

- A root component may render `<html>`, `<head>` and `<body>` in TSX. The server adds only what the framework owns: the doctype, the listener, the loader script, preload links and `<Head>` output in `<head>`, and the state script at the end of `<body>`. No `start`/`end` strings, no document template, no string concatenation in user code.
- The compiler accepts `html`, `head` and `body` in a view (today it may reject or mis-place them): static attributes, bound attributes (`lang={...}`) and a static `<title>`/`<meta>` in the document's `<head>`. Decide what may be dynamic, and how `<Head>` and the document `<head>` combine, in a view-ir change request.
- The server learns the loader URL and chunk map from the client build without user code (the plugin writes them, the server reads them), and uses the dev URL under `vite dev`. The nonce applies to every script it adds.
- An entry is one call: `renderToStream(App, props, { nonce })` (from `render-stream`), or a `handle(request, ...)` that returns a `Response`. The plugin's dev middleware uses the same path, so dev and production send the same document.
- Update `examples/*`, the benchmark apps, `website/src/demo/build.ts`, getting started, components, head, deploying (Node and Vercel) and the README to the new form.

## Acceptance

- `examples/todo` has an `App` component that renders the whole document, and an entry with no HTML string and no manifest read; e2e passes in dev and on the production server.
- A test renders a document component and checks the doctype, the framework scripts in `<head>`, the state script in `<body>`, and the nonce on each script.
- Differential test covers a document component.
- Docs show the new setup; the website builds.

Landed as 76aabe3..2534cdf on `batch/core` after the user approved the proposal and one fresh review round. Decision 14 (a separate `app.tsx`) was dropped: a stateful child puts the todo loader over budget, and the user chose to keep the root rendering the document, since layouts arrive with routing (2026-11-23).
