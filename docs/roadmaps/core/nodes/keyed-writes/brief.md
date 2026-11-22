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

## Updates after wave 7

- `keyed-paths` landed. A keyed path prints `todos[id=selected].text`, the manifest keeps it, `getChunkFile` maps `[`, `]` and `=` to `(`, `)` and `~`, and `diffPaths` in `src/client/patch/diff.ts` reads the source as a model path from each model root, with `HAS_KEYED` gating the code. This node adds `$p.<n>` and `$p.<n>.<field>` sources: the loader replaces them with the payload value before it diffs. Read `test/client/patch/keyed.test.ts` first, and reuse its cases.
- `HAS_KEYED` already covers the keyed segment, so the new loader code goes behind it. Its detector looks for `[` in a group path, which also matches a write set path. Check that the `writes` of a handler are counted by the detector, or add them.

## Updates after wave 9

- `write-sets` is in `compiled-format` v11 (Write sets): `meetsPath` in `compiler/update/writes.ts` treats `name[field=source]` as `name.*`. Reuse it.
- The `HAS_KEYED` detector (`src/vite/features.ts`) reads only group paths. A `$p.<n>` source appears in handler `writes`, so extend the detector to read `manifest.handlers[*].writes` too, or the replacement code is dropped from a build whose groups have no `[`.
- A handler of a child component runs against the slot's model. The `$p` index counts the payload of that handler, and the payload's owner is not part of it.
- Every handler entry with `bindings` also lists `$dynamic` when the module has the group (`dynamic-paths`). Keep it when you change `bindings`.
- Loader budget: the todo loader with no flags is 3881 B gzip against 3900 B in the e2e test (`loader-trim`), so the flag-on code must sit behind `HAS_KEYED` and cost nothing when off.

## Updates 2026-11-22

- `for-key-callback` landed: `<For key={(t) => t.id}>`. Only a single-field key keeps keyed paths; any other key (nested field, template literal) is computed, the list chunk exports `key(item)`, and write sets under it are `*`. Read `nodes/for-key-callback/outcome.md` before starting. Consider supporting a nested field path (`t.meta.id`) as a keyed segment here.
