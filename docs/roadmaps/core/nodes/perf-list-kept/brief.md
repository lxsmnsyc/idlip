---
id: perf-list-kept
title: Run row bindings only on rows that change
status: todo
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
verify: pnpm --filter idlip test && pnpm -C benchmarks/harness bench --scenario rows --only idlip,marko --rounds 1
exclusive: [bench]
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - packages/idlip/src/client/list/**
  - packages/idlip/src/client/patch/diff.ts
  - packages/idlip/src/client/patch/patch.ts
  - packages/idlip/src/client/patch/blocks.ts
  - packages/idlip/test/client/list/**
  - packages/idlip/test/client/patch/**
shared:
  - packages/idlip/src/client/CLAUDE.md
reserves: []
provides: []
depends_on:
  - on: cloned-templates-all
    kind: hard
    why: works on the same client render and list code
  - on: cloned-templates
    kind: hard
    why: rewrites the list code this node tunes
  - on: perf-list-create
    kind: hard
    why: changes the same patchList code right after it
---

# Run row bindings only on rows that change

## Goal

Select, swap, remove, update every 10th and clear stop doing work on every kept row. Each gets faster by more than the noise.

## Context

- From `nodes/bench-rows/outcome.md`: append profiled a pass over all 1,000 kept rows (`walk`, `findNodes`, `patchRow`, `readRows`, `checkKeyed` in `src/client/list/index.ts` and `src/client/patch/diff.ts`); `patchList` has the comment "A chosen row binding runs on every kept row". Guessed for select (2.7x, 3.6x: `rows._.id_selected` runs on 1,000 rows where 2 change), swap, remove, update every 10th, and clear (`removeRange` and `removeBlock` per row where the others clear the parent at once).
- Profile each guessed operation on `batch/core` before changing it, and drop the ones the profile does not place in this code.
- Ideas: skip `patchRow` for a kept row whose item and read paths did not change; for a binding that reads a scalar outside the row (`selected`), compare old and new value per row before touching the DOM; clear by range removal when every row leaves and no row has a remove hook.

## Acceptance

- [ ] Proof on `batch/core`: profiles and `bench.py` numbers for each operation, in `log.md`.
- [ ] Each operation kept in scope is faster by more than the noise; before and after in the outcome.
- [ ] `pnpm --filter idlip test` and `pnpm --filter e2e test` pass; the todo loader stays under 4096 B gzip.

## Notes for the worker

- Use the perf-pass skill.

## Updates 2026-11-22

- Run after `cloned-templates` (the list code changes under you). Read brumate's `docs/performance.md` "What the costs were" first: a longest increasing subsequence for moves, no re-run of updates on freshly rendered rows, no loader rescan after insert. Check each against `src/client/list/index.ts`.
- From `brumate-lessons` row 2: each kept row builds two scopes with array spreads (`client/list/index.ts` 145-147, 302-303), `findNodes` walks each row (150-165), and `patchRow` is `async` and awaited once per row (168, 304). Make `patchRow` synchronous when no binding can fail, and compare old and new values before walking a row.
