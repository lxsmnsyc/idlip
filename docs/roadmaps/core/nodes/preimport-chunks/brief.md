---
id: preimport-chunks
title: Preload click chunks and import them before the click
status: todo
priority: should
type: feature
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
spent:
owns:
  - benchmarks/prefetch/**
shared:
  - packages/idlip/src/client/loader/**
  - packages/idlip/src/server/preload.ts
  - packages/idlip/src/vite/**
  - examples/todo/**
  - benchmarks/idlip/**
  - benchmarks/harness/**
  - benchmarks/README.md
  - e2e/**
reserves: []
provides: []
depends_on:
  - on: plain-tsx
    kind: hard
    why: edits the renamed examples and benchmark apps
---

# Preload click chunks and import them before the click

From `brumate-lessons` rows 1 and 3, approved by the user on 2026-11-22.

- `renderPreload` (`server/preload.ts`) exists, but the benchmark apps and `examples/todo` never call it (`prefetch` left it unwired for lack of a typed `manifest` export). The dashboard first click costs 3 requests and 219 ms at 150 ms RTT, against 56 ms for brumate. `prefetch/outcome.md` measured 221 to 54 ms on todos with the links on.
- Brumate `af923d74`: an `import()` of a module that is already loaded still resolves in its own task, after the next frame. Starting the import before the click and keeping the promise cut its first select from 26 to 12 ms (31 to 2 ms on a small page). idlip keeps one promise per URL in `loads` (`client/loader/resume.ts:140-170`) but starts no import before the click.

## Do

1. Give the server a typed way to get the build manifest so `renderPreload` can be wired (the `prefetch` gap), and wire it into `examples/todo` and the three idlip benchmark apps.
2. After `load`, at idle, the loader calls its `load(url)` for the chunks the preload links name, so the click awaits a settled promise. Respect the loader budget (4096 B gzip for todo); put it behind a feature flag if needed.
3. The benchmark README reports first-click numbers with preload on and off, labelled, so idlip is compared with brumate on the same loading choice.

## Acceptance

- `benchmarks/prefetch/run.mjs` and the dashboard first-click metric: before/after with preload on, gain above noise, numbers in outcome.md.
- JS before `load` unchanged (preload links are fetched, not executed, before `load`; check the scale benchmark's headline metric stays flat).
- e2e todo spec passes; loader budget holds.
