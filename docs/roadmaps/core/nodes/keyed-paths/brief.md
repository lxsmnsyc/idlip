---
id: keyed-paths
title: Keyed path segments in view analysis and diff
status: done
priority: should
type: feature
story:
early: false
outline: false
milestone: apps
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter idlip exec vitest run test/compiler/view test/client/patch test/fixtures
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-20
spent: 166682
owns:
  - packages/idlip/test/compiler/view/analyze/fixtures/keyed.idlip.tsx.txt
  - packages/idlip/test/compiler/view/analyze/expected/keyed.txt
  - packages/idlip/test/client/patch/keyed.test.ts
shared:
  - packages/idlip/src/compiler/view/analyze/analyze.ts
  - packages/idlip/src/compiler/view/analyze/print.ts
  - packages/idlip/src/compiler/view/codegen/expr.ts
  - packages/idlip/src/compiler/view/codegen/plan.ts
  - packages/idlip/src/client/patch/diff.ts
  - packages/idlip/src/core/format.ts
  - packages/idlip/test/fixtures/reference.ts
reserves: []
provides: []
depends_on:
  - on: patch-lists
    kind: contract
    via: compiled-format
  - on: analyze-v9
    kind: hard
    why: extends analyze.ts, a single 3000-line file
---

# Keyed path segments in view analysis and diff

## Goal

Read side only. A hole such as `todos.find((t) => t.id === selected).text` becomes static, with the paths `todos[id=selected].text, selected`. The key field must be the `key` of a `<For>` over that list. Otherwise the paths fall back to `todos.*.id, todos.*.text, selected`, which are still static. Code generation emits the expression, and `diffPaths` compares the one item found by key in `prev` and in `next`. Keyed writes (`$p`) are `keyed-writes`.

## Context

- Source: `docs/proposals/0003-update-analysis.md`, Keyed paths. `Segment.keyed` is already in `ir.ts`.
- Change requests:
  - view-ir, Expressions and Holes and paths: `find` with a predicate `(x) => x.<field> === <expr>` joins the grammar, and its paths emit `keyed`.
  - compiled-format, Manifest and Chunk URLs: `getChunkFile` must map `[`, `]` and the `=` inside a key (today `binding=todos[id=selected].text` becomes `binding.todos[id.selected].text.js`). Fix a URL-safe mapping, for example `[` to `(`, `]` to `)` and `=` to `~` inside brackets. Also fix the `diffPaths` meaning of a keyed segment: an item missing on one side counts as a change.

## Acceptance

- [x] The analyze fixture `keyed` prints keyed paths for `find` over a `<For>` list and the `*` fallback for a list without one.
- [x] `keyed.test.ts`: changing `selected` or the selected item is a change. Changing another item is not a change. A missing key on one side is a change.
- [x] Group chunk names with keyed segments give valid file names and Vite ids. Covered by a test of `getChunkFile`.
- [x] Existing fixtures are unchanged.

## Sizing

M: analysis, codegen and diff; known pattern; hot shared files.

## Notes for the worker

- `nesting-compile` and `form-fields` may also edit `analyze.ts`. Keep the change local to the method lowering.
- `dynamic-paths` waits for this node.
