---
id: fix-flaky-tests
title: Find and fix the flaky unit tests
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
spent: 73720
owns:
  - packages/idlip/test/client/tasks/tasks.test.ts
  - packages/idlip/test/client/list/list.test.ts
  - packages/idlip/test/**/settled.test.ts
shared: []
reserves: []
provides: []
depends_on: []
---

# Find and fix the flaky unit tests

## Goal

Workers saw single failures that passed on rerun: `test/client/tasks/tasks.test.ts` (a timing-dependent undefined read, seen by `write-sets`), `test/client/list/list.test.ts` (a property test) and `settled.test.ts` (both seen by `global-events`, with other agents loading the machine). Reproduce each (loop the file, under load, and with the property test's failing seed if fast-check prints one), find the cause, and fix the test or the code. A real bug in the code under test is a finding, not a test fix: report it.

## Acceptance

- [x] Each failure is reproduced, with the command and seed in `log.md`, or recorded as not reproduced after 50 runs under load.
- [x] The verify loop passes 10 times in a row.

## Sizing

S: three tests.

Landed as 890467e on `batch/core` after self-review. `settled.test.ts` (11/75) and `list.test.ts` (2/75, a test bug with a todo titled `/t`) reproduced and fixed; `tasks.test.ts` not reproduced in 105 runs, fixed waits anyway. All in tests, no code bug. Flakes later reported in `nest` and `loader` tests (after this branch was cut) are not covered.
