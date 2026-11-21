---
id: hmr
title: Hot updates that keep the model
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
verify: pnpm --filter idlip test -- hot
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-20
spent:
owns:
  - packages/idlip/src/vite/hot.ts
  - packages/idlip/src/client/hot.ts
  - packages/idlip/test/vite/hot*.test.ts
  - packages/idlip/test/client/hot*.test.ts
shared:
  - packages/idlip/src/vite/plugin.ts
  - packages/idlip/src/client/index.ts
  - packages/idlip/src/client/loader/resume.ts
reserves: []
provides: []
depends_on:
  - on: vite-plugin
    kind: behavior
    via: compiled-format
---

# Hot updates that keep the model

## Goal

In `vite dev`, an edit to a handler or a binding swaps the chunk and keeps the model. An edit that changes markup renders the page again on the server with the current model. Today `hotUpdate` in `src/vite/plugin.ts` sends `full-reload` for every `*.idlip.tsx` edit.

## Context

- Prior art: `../brumate/packages/brumate/src/runtime/hot.ts` (`hotLoad` wraps the load and listens for an update event) and the plugin side in `../brumate/packages/brumate/src/vite`.
- Classify an edit by comparing the manifest before and after: same `view` markup, groups and handler names means chunk swap; otherwise remount. Reuse `compile()` output; do not diff source text.
- The chunk swap hooks the `load` function that `resume()` gets through `page.load`: a wrapper that appends `?t=<timestamp>` for changed chunks. Do not edit `resume.ts` beyond passing the wrapper.
- The remount asks the server for the page (`render(url)` through the dev middleware) with the current model, replaces the root's HTML and re-reads the state script. The model comes from the loader's `Root.model`.
- Keep the lifecycle explicit: `'idle' | 'swapped' | 'remounting'`.

## Loader budget

Dev only. The client code sits behind `import.meta.hot` so the production build removes it. Flag-off cost must be 0 B: the e2e budget test and a test that builds the todo app and greps the output for `idlip:hot` prove it. No `HAS_*` flag is needed; if `import.meta.hot` does not fold in the loader build, use a flag `HAS_HOT` off in builds.

## Acceptance

- [ ] An edit to a handler body loads the new chunk on the next event and the model is unchanged (dev server test).
- [ ] An edit to markup remounts with the current model.
- [ ] The production todo build is byte-identical in the loader with and without this node.
- [ ] Fast check passes: `pnpm --filter idlip test`
- [ ] Change request: `contracts/compiled-format-hot.change-request.md` (event name and payload).

## Sizing

Dev plumbing with a classification step; no loader cost.

## Notes for the worker

- Use `hotUpdate` of the client environment, where it exists now. The ssr environment keeps Vite's default handling.
