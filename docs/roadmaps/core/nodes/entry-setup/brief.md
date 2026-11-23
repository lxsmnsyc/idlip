---
id: entry-setup
title: A proper server entry, without hand-built documents
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
size: M
spike: false
hypothesis:
verify: pnpm --filter idlip build && pnpm --filter idlip test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-23
spent:
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

# A proper server entry, without hand-built documents

User request (2026-11-23). Today every entry builds the document as a string: `<!doctype html>`, `renderListener()`, a loader `<script>` whose URL is `/@id/idlip/client` in dev, and in production a URL that `website/docs/deploying.md` reads by hand from `.vite/manifest.json`. Preload links and the nonce are wired by hand too.

Read first: brumate `website/docs/getting-started.md` ("Serve pages in development"), `deploying.md`, `reference-plugin.md` (how the plugin hands client bundles to the server: `.brumate/hints.json`, `setClientBundles`), and `examples/todos/server.ts`.

## Do

- The server learns the loader URL and chunk map from the client build without user code (the plugin writes them, the server reads them at start), and uses the dev URL under `vite dev`.
- One call answers a request: for example `handle(request, { Component, props, nonce })` returning a `Response` whose body is the `renderToStream` stream, with the CSP nonce and preload links applied. Users keep control of the document shell (title, lang, extra head) through options or a small template, not string concatenation.
- Dev server: the plugin's existing middleware uses the same path, so dev and production render the same document.
- Update `examples/*`, the benchmark apps, `website/src/demo/build.ts`, getting started, deploying (Node and Vercel) to the new entry; the hand-written manifest parsing disappears from the docs.

## Acceptance

- `examples/todo` entry is under 20 lines with no document string and no manifest read; e2e passes in dev and on the production server.
- Getting started and deploying show the new setup; the website builds.
