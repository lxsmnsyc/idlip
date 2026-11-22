---
id: shared-templates
title: One template per markup across chunks, cached parse, encoded walk
status: todo
priority: must
type: perf
story:
early: false
outline: false
milestone: 0.1
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter idlip build && pnpm --filter idlip test
exclusive: [benchmark]
fulfilled_by:
gate: false
added: 2026-11-23
spent:
owns:
  - packages/idlip/src/compiler/view/codegen/**
  - packages/idlip/test/compiler/view/codegen/**
shared:
  - packages/idlip/src/core/helpers.ts
  - packages/idlip/src/vite/**
  - packages/idlip/test/vite/**
  - packages/idlip/test/differential/**
  - benchmarks/**
  - e2e/**
reserves: []
provides: []
depends_on:
  - on: cloned-templates-all
    kind: hard
    why: changes the template code it emits
  - on: shared-helpers
    kind: hard
    why: shared templates ship the way the helpers module does
---

# One template per markup across chunks, cached parse, encoded walk

User decision (2026-11-23): Solid and Svelte keep one template per module and parse it once. idlip emits each template as a `const` in every chunk that renders it, so the same markup is downloaded and parsed once per chunk. Measured on batch/core: the dashboard benchmark has one row template (`<!--i--><li i-a="2"><!--x1--></li><!--/i-->`) in 100 chunks (99 extra copies, about 4.4 kB raw, 99 extra parses), the scale app has it in 20. todo and rows have none.

Read first: `nodes/cloned-templates/outcome.md`, `nodes/cloned-templates-all/outcome.md`, `nodes/shared-helpers/outcome.md` (how the helpers module is a virtual module, a chunk-map key and a preload). Brumate: `packages/brumate/src/runtime/client/templates.ts` (`template`, `parseTemplate`, `encodeWalk`) and how its codegen hoists templates.

## Do, in this order (each its own commit)

1. **Shared templates**: when the same template HTML (and namespace) is rendered by more than one chunk, emit it once in a virtual module keyed by a non-crypto hash of its content (xxh32 or the hash the build already uses), and import it from each chunk. A template used by one chunk stays inline: no extra request in the common case. The module must reach the page the way the helpers module does: chunk map entry, preload links from `renderPage().chunks`, dev server, HMR. Identical markup in different components must share one module.
2. **Cached parse**: keep the parsed content on the template object for the page's document; keep a fallback for another document (iframes, tests) without a `WeakMap.get` on the common path.
3. **Encoded walk**: replace the root-to-mark path walk per clone with brumate's `encodeWalk` moves (one pass from mark to mark). Measure it; keep it only if it is faster beyond noise or the same speed and smaller.

## Constraints

- Differential render test green at every commit. Loader budget 4096 B gzip (currently about 3991 B); the walk lives in helpers, not the loader, unless measured otherwise.
- A/B with a fixed N chosen before running, load < 3: rows create/append/replace, dashboard first click and total client JS, scale. Nothing slower beyond noise.

## Acceptance

- A test builds an app with two components that render identical markup and finds the template HTML once across all client chunks.
- Dashboard client JS and template copies before/after in outcome.md; perf numbers before/after.
- Build, unit, differential and e2e pass.
