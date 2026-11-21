# Change request: compiled-format v9 to v10

- From node: patch-lists
- Status: accepted and applied by the orchestrator on 2026-11-21. The `patch-bindings` review found the same gap.

## Problem

v9 says `patch()` calls `patchList` for each chosen `l` binding, and `patchList` runs a chosen row binding on every kept row. A row binding whose paths are all outside the list, such as `class={selected === t.id}` with the path set `selected, todos.*.id`, sits in a group whose chunk exports `a<id>` but not `l<id>`: `l` reads `todos`, a different group. When only `selected` changes, no `l` is chosen, so `patch()` never calls `patchList`, and the row binding never runs. `patchList(start, prev, next, context)` also needs the list arrays, which `patch()` cannot compute without the `l` export.

## Proposed change

A binding chunk also exports the `l<id>` of every list that holds one of its row bindings, and of the enclosing lists up to the outermost, the way it exports covered bindings. `patch()` then calls `patchList` for each list that has a chosen row binding or a chosen `l` binding, and puts the chosen `l` of nested lists into `ListContext.bindings`. `ListContext.bindings` holds all chosen bindings of the list and of its nested lists, since `patchList` filters them by each entry's `bindings`.

## Affected nodes

`compile-view-codegen` (exports), `patch-bindings` (which lists to patch), `patch-lists`.

## Workaround in place

`patchList` runs the chosen row bindings of the context on every kept row, and for a nested `l` in the context it recurses. It runs nothing for a list the patcher does not call.

## Decision

Filled in by the orchestrator.
