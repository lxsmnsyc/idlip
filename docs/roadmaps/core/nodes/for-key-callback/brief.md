---
id: for-key-callback
title: Take the <For> key as a callback of the item
status: todo
priority: must
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
verify: pnpm --filter idlip build && pnpm --filter idlip test && pnpm --filter website build && pnpm --filter website check:samples
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-22
spent:
owns:
  - packages/idlip/src/core/blocks.ts
  - packages/idlip/test/compiler/view/**
  - packages/idlip/test/client/list/**
shared:
  - packages/idlip/src/compiler/**
  - packages/idlip/src/client/list/**
  - packages/idlip/src/client/patch/**
  - packages/idlip/src/server/**
  - packages/idlip/test/fixtures/**
  - examples/**
  - benchmarks/idlip/**
  - website/docs/**
  - website/src/repl/**
  - website/src/landing/**
  - docs/roadmaps/core/contracts/compiled-format.change-request.md
reserves: []
provides: []
depends_on:
  - on: plain-tsx
    kind: hard
    why: edits the renamed fixtures and examples
---

# Take the <For> key as a callback of the item

User decision (2026-11-22): `<For>` takes its key as a callback, `key={(todo) => todo.id}`, like Solid 2.0's keyed function, instead of a field name string (`key="id"`, typed `keyof T & string` in `core/blocks.ts`). One form only: the string form goes (TSX is the one syntax; no two ways to say one thing).

## Do

- Type: `key: (item: T) => string | number` (decide whether other primitives are allowed; the key is written into the HTML, so it must serialize stably).
- The callback is an arrow with one parameter and an expression body. The body is in the closed hole grammar (`docs/reference/compiler.md`), so the compiler can evaluate it on the server and in the list chunk without shipping arbitrary code: a field path (`t.id`, `t.meta.id`), a template literal (`` `${t.kind}:${t.id}` ``), and so on. Anything outside the grammar is a diagnostic (reuse or replace `for-key`).
- **Keyed paths.** When the body is a plain field path, keyed paths keep working as today (`todos[id=…].done`, `getChunkFile` mapping, `diffPaths`), with the path possibly nested (`todos[meta.id=…]`; check the manifest form supports a dotted field, or write a change request). When the body is any other expression, the list still moves rows by key, but write sets on that list treat the keyed segment as `*` (correct, coarser). Say so in the docs.
- Server and client agree on the key value for every row (property test over random items).
- Update every `<For ... key="...">` in the repo: examples, benchmarks/idlip, fixtures, docs (`views.md` and reference), REPL examples, the landing sample if it uses `<For>`.
- Coordinate with `keyed-writes` (milestone 0.2): it relies on the key being a field; leave a note in its brief's "Updates" via the orchestrator (write it in outcome.md, do not edit the brief).

## Acceptance

- `key={(t) => t.id}` and a nested field compile to the same keyed paths as the old `key="id"` for the todo example (chunk names unchanged).
- A computed key (template literal) renders, reorders rows and patches correctly, with `*` write sets.
- `key="id"` is a diagnostic that names the callback form.
- Verify passes; e2e todo spec unchanged.
