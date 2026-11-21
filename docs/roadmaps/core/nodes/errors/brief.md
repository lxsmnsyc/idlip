---
id: errors
title: Errors: throwing handlers, chunk loads and boundaries
status: todo
priority: should
type: feature
story:
early: false
outline: true
milestone: apps
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-20
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: resume-loader
    kind: hard
    why: wraps handler dispatch
  - on: ssr-render
    kind: hard
    why: server fallbacks render inside the server renderer
  - on: patch-bindings
    kind: hard
    why: client fallbacks replace a region when a patch throws
---

# Errors: throwing handlers, chunk loads and boundaries

## Goal

`<Try catch={(error, reset) => ...}>` boundaries from `docs/proposals/0004-effects-refs-errors.md`, Error boundaries: the server renders the `catch` view in place of a body that throws, and the client swaps a boundary's region when a binding or a subscription source inside it throws, keeping the model. `reset` renders the body again. A handler that throws keeps the model and fires `idlip:error`. A chunk that fails to load is retried once, then fires `idlip:error`.

## Updates after wave 7

- Put the loader code behind a `HAS_<NAME>` flag (`HAS_ERRORS`), following the recipe in `nodes/runtime-flags/outcome.md`: a `declare const` and export in `src/client/features.ts`, one line in `DETECTORS` of `src/vite/features.ts`, and `if (HAS_ERRORS)` around the code. The 4096 B gzip budget is the loader with no optional features, so the flag removes your cost from apps that do not use it. Report the feature's cost; it is not capped. The detector is on when a manifest has `fallback` on a region. A chunk load retry and `idlip:error` for a throwing handler are loader code too: gate the part that only `<Try>` apps need, or report its size.
- `runTask` reports a failed task chunk through `host.report` and keeps the step's model. Hook the `<Try>` swap on that report instead of a new path.
