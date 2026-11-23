---
id: repl-origin
title: Run REPL and live sample frames on a separate origin
status: todo
priority: must
type: fix
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
verify: pnpm --filter website build && pnpm --filter website test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-23
spent:
owns:
  - website/src/repl/**
  - website/src/live/**
shared:
  - website/**
  - e2e/**
reserves: []
provides: []
depends_on: []
---

# Run REPL and live sample frames on a separate origin

From the `website-repl` review (inbox, 2026-11-22): the REPL frame runs on the site's own origin with no sandbox, so code from a crafted share link can reach the parent page and `localStorage`. The public site must not ship that.

Read first: `website/src/repl/` (`app.ts`, `frame-document.ts`, the worker), `website/src/live/`, the inbox entry, and how the Svelte and Solid REPLs isolate their frames (a separate origin per run, or `sandbox` without `allow-same-origin`).

## Do
- Frames that run user code (the REPL, live samples after an edit) load from a separate origin, or from a `sandbox` frame without `allow-same-origin`, and talk to the page only through `postMessage` with origin checks.
- Choose between a second origin (subdomain or second Vercel project: a hosting choice, list it for the user at the `website` gate) and an opaque-origin sandbox (no `localStorage`, module workers and blob URLs need checking). Prototype the sandbox first; it needs no hosting change.
- Static live-sample frames that run only the site's own build may stay same-origin; say so in the outcome.

## Acceptance
- A test (or e2e) shows code in a REPL frame cannot read `parent.document` or the site's `localStorage`.
- The REPL, share links and live samples still work; the website builds and its tests pass.
