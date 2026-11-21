---
id: fix-flaky-tests-2
title: Find and fix the flaky loader and nesting tests
status: done
priority: should
type: fix
story:
early: false
outline: false
milestone: apps
target:
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify: for i in 1 2 3 4 5 6 7 8 9 10; do pnpm --filter idlip test || exit 1; done
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent: 77632
owns:
  - packages/idlip/test/client/loader/**
  - packages/idlip/test/client/nest/**
  - packages/idlip/test/client/tasks/effects.test.ts
shared: []
reserves: []
provides: []
depends_on:
  - on: fix-flaky-tests
    kind: hard
    why: same method, later tests
---

# Find and fix the flaky loader and nesting tests

## Goal

Under load, these failed once and passed on rerun: `test/client/loader/loader.test.ts` (four tests, including "applies two clicks before the chunk resolves in order" and "reports a failed binding chunk through the patch, not the preload"), `test/client/nest/nest.test.ts` (client-added row, same-key row) and `test/client/tasks/effects.test.ts`. Use the method of `fix-flaky-tests` (see its outcome): loop each file under load with shuffle, find fixed waits or shared state, and fix the test. A real code bug is a finding: report it, fix it only if small.

## Acceptance

- [x] Each failure reproduced with command and rate in `log.md`, or not reproduced after 50 runs under load.
- [x] The verify loop passes 10 times in a row.

## Sizing

S: three test files.

Landed as c6be173 on `batch/core` after self-review. `nest.test.ts` reproduced (5 of 51) and fixed; the others not reproduced and fixed anyway. Every cause was a fixed wait in a test; tests now use `settled()`, `reached()` and `until()`. No code bug.
