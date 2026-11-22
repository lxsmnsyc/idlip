---
id: fix-string-length
title: Patch bindings that read the length of a string
status: done
priority: must
type: fix
story:
early: false
outline: false
milestone: 0.1
target:
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify: pnpm --filter idlip build && pnpm --filter idlip test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-22
spent: 66000
owns:
  - packages/idlip/test/client/patch/string-length*
shared:
  - packages/idlip/src/client/patch/diff.ts
  - packages/idlip/test/differential/**
reserves: []
provides: []
depends_on:
  - on: cloned-templates-all
    kind: hard
    why: found there; touches the same patch code
---

# Patch bindings that read the length of a string

Found by `cloned-templates-all` (also broken before it): `diffPaths` in `src/client/patch/diff.ts` reads `.length` of a string as `undefined`, so a hole that reads `row.label.length` (or `draft.length`) never patches when the string changes. Fix the diff for `length` on strings (and check other primitives the hole grammar allows `length` on), add a unit test and a differential subject with a string length hole in a row and at the top level.
