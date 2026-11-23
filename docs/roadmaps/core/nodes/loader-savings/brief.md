---
id: loader-savings
title: Make room in the loader before new loader features
status: todo
priority: must
type: perf
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
exclusive: [benchmark]
fulfilled_by:
gate: false
added: 2026-11-23
spent:
owns:
  - packages/idlip/src/client/**
shared:
  - packages/idlip/src/core/**
  - packages/idlip/src/compiler/**
  - packages/idlip/src/vite/features.ts
  - packages/idlip/test/**
  - e2e/**
  - docs/roadmaps/core/contracts/**
reserves: []
provides: []
depends_on: []
---

# Make room in the loader before new loader features

The todo loader is 4087 B gzip against a 4096 B budget (contract), 9 B of room. `stream-model` and the loading UI need loader code, so they cannot land until there is room.

Read first: `packages/idlip/src/client/CLAUDE.md` (flag recipe, flag costs, the rules that each saving must keep), `nodes/loader-trim/outcome.md`, `nodes/event-callbacks/outcome.md` (what grew the loader last), and the e2e `loaderBudget` test.

## Do
- Profile the todo loader by module and by function (bundle with the flags of the todo app, gzip -9 per function contribution). List the candidates with their size.
- Find savings that keep behaviour: shared code paths, smaller encodings in the state script the loader reads, code that only some apps need moved behind a `HAS_*` flag, dev-only code that reaches production.
- Each saving is its own commit with its before/after gzip size and the tests that cover the path.

## Acceptance
- The todo loader is at most 3800 B gzip -9 (about 300 B of room), or the outcome explains why not with the list of what was tried.
- Unit, differential and e2e tests pass; the flag-cost list in `client/CLAUDE.md` is updated.
