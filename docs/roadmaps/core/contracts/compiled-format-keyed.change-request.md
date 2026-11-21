# Change request: compiled-format, keyed segments

- From node: keyed-paths
- Status: open

## Problem

1. `getChunkFile` replaced every `=`, so `binding=todos[id=selected].text` became `binding.todos[id.selected].text.js`. The `[` and `]` are not URL-safe and the key is unreadable.
2. The contract does not say what `diffPaths` compares for a keyed segment.

## Proposed change

1. Chunk file names: the first `=` separates the kind and becomes `.`. Inside a path, `[` is `(`, `]` is `)` and `=` is `~`. `binding=todos[id=selected].text` is `binding.todos(id~selected).text.js`. Other mappings are unchanged (`*` is `_`, `,` is `+`). Chunk ids (`getChunkId`) keep the raw chunk name.
2. `diffPaths` for `name[field=source]`: `name` is read from the value reached so far, and `source` is a model path read from the root of each model. The item whose `field` equals the source value is found in `prev` and in `next`, and the rest of the path is compared on the two items. An item found on one side only is a change. An item missing on both sides is not. A reorder is not a change. Paths split at dots outside brackets, so a source may contain dots.

## Affected nodes

`keyed-writes` (the `$p` source on the write side), `write-sets`, `dynamic-paths`, `prefetch`.

## Workaround in place

Implemented in `packages/idlip/src/core/format.ts` and `packages/idlip/src/client/patch/diff.ts`, with tests in `test/client/patch/keyed.test.ts`.

## Decision
