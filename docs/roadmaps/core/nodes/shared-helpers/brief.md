---
id: shared-helpers
title: Stop copying runtime helpers into every chunk
status: done
priority: should
type: refactor
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
added: 2026-11-22
spent: 871000
owns:
  - packages/idlip/src/core/helpers.ts
  - packages/idlip/src/core/dynamic.ts
  - packages/idlip/src/compiler/view/codegen/**
  - packages/idlip/src/compiler/update/**
  - packages/idlip/src/client/**
  - packages/idlip/test/**
shared:
  - packages/idlip/src/vite/**
  - packages/idlip/src/compiler/CLAUDE.md
  - benchmarks/**
reserves: []
provides: []
depends_on:
  - on: multi-component-files
    kind: hard
    why: both rewrite chunk codegen
---

# Stop copying runtime helpers into every chunk

The user saw in the REPL that output chunks repeat the same helper code (`setAttr$` and the other `$` helpers). Today codegen copies each helper's `toString()` into every chunk that uses it (`compiler/CLAUDE.md`, `core/helpers.ts`). `spike-chunk-split` chose this so a first click costs 2 requests (handler + binding chunk), and rejected rolldown's inlined common chunks (they added `__share` wrappers and a 1.2 kB runtime chunk). The cost is in the inbox since `bench-rows`: dashboard client JS 3.1x and 11.7x gzip behind, about 7 small chunks per widget, each with its own copies.

## Options to measure (perf-pass skill, `benchmarks/harness`)

1. **Helpers in the loader.** The loader already holds the patch runtime; move the helpers there and have chunks read them from the loader's scope (`$idlip` global or an argument the loader passes when it calls a chunk). Grows the loader a little; zero extra requests; no duplication. Feature flags (`vite/features.ts`) can drop unused helpers.
2. **One shared helpers module** that chunks import, preloaded by the loader in the same round trip as the first handler (`modulepreload`), so the first click is still one round trip (3 requests, in parallel).
3. Keep copying (baseline).

Measure: loader gzip, first-click bytes and requests (e2e todo spec counts), total JS after N clicks on the dashboard and rows benchmarks. Pick the option with the lowest total that keeps the first click to one round trip; prefer the simplest. Record numbers in outcome.md and update `compiler/CLAUDE.md` rules and the `chunk-helpers` notes.

## Acceptance

- No helper body appears in more than one emitted file of a build (test over the todo and dashboard builds).
- First click still one network round trip; e2e request-count assertions updated only if option 2 is picked, with the reason.
- Benchmarks rerun on a quiet machine (load < 3); numbers in outcome.md.

## Updates 2026-11-22

- From `multi-component-files`: builds emit two view files per child (for example `counter.view.<hash>.js` and `counter.tsx_idlip-view_lang.<hash>.js`, also in `examples/counters`), probably because Rolldown splits the view module out when it is both an entry and a static import. Remove the duplicate as part of this node, and count it in the "no helper body in more than one file" test.
- The todo loader is 4007 B of the 4096 B budget. Option 1 (helpers in the loader) must stay within it, behind feature flags, or report the numbers and stop.
