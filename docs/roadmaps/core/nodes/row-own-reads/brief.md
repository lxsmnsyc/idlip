---
id: row-own-reads
title: Skip kept rows whose item did not change, with a compiler mark
status: todo
priority: should
type: feature
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
owns: []
shared:
  - packages/idlip/src/compiler/**
  - packages/idlip/src/client/list/**
  - packages/idlip/src/client/patch/**
  - packages/idlip/test/**
  - docs/roadmaps/core/contracts/**
reserves: []
provides: []
depends_on:
  - on: perf-list-kept
    kind: hard
    why: its change request asks for this mark
---

# Skip kept rows whose item did not change, with a compiler mark

`perf-list-kept` tried skipping kept rows whose item kept its reference and found it unsound: the manifest gives the same paths for a row reading its own item (`r.label` → `rows.*.label`) and for a row reading another item of the same list (`rows[first]?.label`, `rows.find(...)`), so after a swap the skipped rows showed stale text. Its tests ("rows that read other items of their list") prove it. Its change request (`contracts/compiled-format-perf-list-kept.change-request.md`) asks the compiler to mark groups that read only their own row item.

Do that: the compiler marks a row binding group as own-item-only when every read goes through the row parameter (no index into the list, no `find` over the list, no outside path); the client skips a kept row whose item is the same reference when every changed group is marked. The first round measured the gain: select -44%, swap -35%, remove -41%, clear -21% main-thread script time (cpu metric). Keep the tests from `perf-list-kept` green; add a test that turning the skip off fails a count test. Loader budget 4096 B gzip.
