---
id: deploy-skew
title: Recover when cached HTML meets a newer client build
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
verify: pnpm --filter idlip test -- skew
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-20
spent:
owns:
  - packages/idlip/src/client/skew.ts
  - packages/idlip/src/vite/skew.ts
  - packages/idlip/test/client/skew*.test.ts
  - packages/idlip/test/vite/skew*.test.ts
shared:
  - packages/idlip/src/vite/plugin.ts
  - packages/idlip/src/client/loader/resume.ts
  - packages/idlip/src/client/features.ts
  - packages/idlip/src/vite/features.ts
  - packages/idlip/src/server/render.ts
reserves: []
provides: []
depends_on:
  - on: errors-client
    kind: behavior
    via: compiled-format
  - on: loader-trim
    kind: hard
    why: loader budget: this node adds loader seams, so it starts after the flag-off seams are trimmed
---

# Recover when cached HTML meets a newer client build

## Goal

A page from a cache can name chunks that a newer deploy removed. The HTML carries a build id. When a chunk fails to load and the server reports a different build, the client reloads the page once per build per tab. `vite-plugin` keeps the assets of the last two builds.

## Context

- Prior art: `../brumate/packages/brumate/src/runtime/skew.ts` (`loadOnce`, 8 builds in `sessionStorage`) and `client/references.ts`.
- `errors-client` fires `idlip:error` after one retry of a failed chunk, and owns the failure point in `load`. Listen for that event; do not add a second catch in `resume.ts`.
- Choices to make and record: where the build id lives (an `i-build` attribute on the state script is cheapest), how the client learns the server's build (a `fetch(location.href)` of the HTML head, or a small file `.idlip/build` served next to the chunks; keep what costs fewer loader bytes), and how `vite-plugin` keeps two builds (`emptyOutDir` is off for the client environment plus a prune step in `writeBundle`).
- Dev: no build id, no skew code.

## Loader budget

Behind `HAS_SKEW`, set by the plugin option `skew` (default on in a production build), not by a manifest detector: add the option read to `getDefines` in `src/vite/features.ts`. Flag-off cost at most 10 B. Flag-on cost reported; the reload check can live in a lazily imported module (it runs only after a failure), so the loader holds the listener only. Aim for 80 B.

## Acceptance

- [ ] A failed chunk with a different server build reloads once; the same build twice does not loop (test with `sessionStorage` in happy-dom).
- [ ] A client build keeps the previous build's chunk files and drops older ones.
- [ ] Todo loader grows at most 10 B over the `loader-trim` result when `skew` is off.
- [ ] Fast check passes: `pnpm --filter idlip test`
- [ ] Change request: `contracts/compiled-format-skew.change-request.md` (build id attribute, build file).

## Sizing

Small runtime, plus plugin output handling and one asset-retention rule.

## Notes for the worker

- One explicit state per tab and build: `'fresh' | 'reloaded'`. No inference from timing.
