---
id: perf-ssr-state
title: Smaller state script and faster server render
status: active
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
verify: pnpm --filter idlip test && pnpm -C benchmarks/harness bench --scenario dashboard --only idlip,marko --rounds 1
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - packages/idlip/src/server/**
  - packages/idlip/src/client/nesting.ts
  - packages/idlip/src/client/loader/**
  - packages/idlip/test/server/**
  - packages/idlip/test/client/nest/**
shared:
  - packages/idlip/src/vite/**
  - packages/idlip/src/client/CLAUDE.md
reserves: []
provides: []
depends_on:
  - on: bench-rows
    kind: hard
    why: the dashboard scenario is the baseline and the proof
---

# Smaller state script and faster server render

## Goal

The state script carries what the client needs and nothing twice. Dashboard and todos SSR HTML get smaller and SSR renders per second go up, both by more than the noise.

## Context

- Measured in `nodes/bench-rows/outcome.md`: the dashboard state script is 75.8 kB of 108.8 kB. The chunk URL map is 37.5 kB, keyed by full module ids such as `/src/widgets/Widget00.idlip.tsx?idlip-handler=run&lang.js`; the child manifests (`modules`) are 32.5 kB; `slots` 5.5 kB. `mergeState` and `collectModules` in `src/server/render.ts` write them.
- Profiled: dashboard SSR is 2.5x and 4.2x behind brumate 0.8.1 and Marko. `mergeState` is 14% self time (object spreads of chunk maps); seroval parse and serialize of that state about 50%.
- Todos (`nodes/bench-brumate-latest/outcome.md`): SSR HTML is 4.4 kB at 0 todos against 812 B for Marko, and SSR renders/s at 3 todos is about 2.3x behind. Check how much of that is the same state script.
- Ideas: short chunk keys (an index or hash) instead of full module ids; write each child manifest once per page, not per instance; build the merged maps without spreads; keep the static parts of the state out of the seroval call.
- The state script format is in `contracts/compiled-format.md` ("State script", `PageState`, `ChunkUrls`). A format change needs `contracts/compiled-format.change-request.md`; adapt locally and continue.

## Acceptance

- [ ] Proof on `batch/core`: state script bytes and SSR renders/s for dashboard and todos (3 todos), with `bench.py` rules, in `log.md`, plus a Node profile.
- [ ] Both shrink or speed up by more than the noise on the branch; before and after in the outcome.
- [ ] `pnpm --filter idlip test` and `pnpm --filter e2e test` pass, including the e2e chunk count on the first click.

## Notes for the worker

- Use the perf-pass skill.
- Deploy skew and HMR read the chunk map: keep `src/client/skew.ts` and `src/client/hot.ts` working (tests).
- Runs beside `perf-list-create` (no `exclusive: bench`): state script bytes are exact; for renders/s use `bench.py` interleaved A/B runs so shared load hits both sides.
