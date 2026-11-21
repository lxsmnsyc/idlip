---
id: keyed-writes
title: Keyed write sets from the message payload
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
size: S
spike: false
hypothesis:
verify: pnpm --filter idlip exec vitest run test/compiler/update test/client/loader test/client/patch
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - packages/idlip/test/compiler/update/keyed-writes.test.ts
shared:
  - packages/idlip/src/compiler/update/writes.ts
  - packages/idlip/src/client/loader/resume.ts
  - packages/idlip/src/client/patch/diff.ts
reserves: []
provides: []
depends_on:
  - on: write-sets
    kind: hard
    why: refines the item-map pattern in writes.ts
  - on: keyed-paths
    kind: hard
    why: needs keyed segments in diffPaths and chunk names
---

# Keyed write sets from the message payload

## Goal

`todos.map((t) => (t.id === id ? {...} : t))`, where `id` is a parameter and `id` is the `<For>` key, writes `todos[id=$p.<n>].done`. Here `n` is the parameter's index in the payload, counting props first. The loader replaces `$p.<n>` with the payload value before it diffs, so one item is compared. Group selection treats the keyed segment like `*`.

## Context

- `$p` in 0003 predates array payloads. Change request to compiled-format, Manifest: a source is `$p.<index>` or `$p.<index>.<field>`.
- The main user is `update-ops` (a `toggle` op on a keyed path), which depends on this node.

## Acceptance

- [ ] `toggle` writes `todos[id=$p.0].done`. Bindings are unchanged. The first-click e2e count is unchanged.
- [ ] A loader test: toggling one item diffs only that item.

## Sizing

S: one pattern, two runtime lines.
