# Change request: mark row bindings that read only their own item

- From node: perf-list-kept
- Status: proposed. Not applied: the client keeps the v9 rule.

## Problem

Behavior, "patchList": a chosen row binding runs on every kept row of its list, whether or not the row's item changed. On the rows benchmark, swap, remove, update every 10th and append run the row bindings on all 1,000 kept rows, though at most 100 items changed.

A first version of `perf-list-kept` skipped a kept row whose item is the same reference when every changed path the chosen bindings read is under `<list path>.*`. That rule is wrong, because the manifest gives the same paths for two different reads:

- `{r.label}` (the row's own item) reads `rows.*.label`.
- `{rows[first]?.label}` reads `rows.*.label, first`, and `{rows.find((x) => x.label === r.label)?.id}` reads `rows.*.id, rows.*.label`. With a computed key, `rows.find((x) => x.id === selected)` also becomes `rows.*.id, rows.*.label, selected`.

After a swap, `rows[first]` changes for rows whose own item did not change, and the skipped rows showed stale text (`test/client/list/kept-rows.test.ts`, "rows that read other items of their list").

## Proposed change

The compiler marks each group whose bindings read the `*` items of a list only through that list's own row item (the `<For>` parameter), for example `"item": true` on `BindingGroup`. A read through the list expression (an index, a `find`, a helper call on the list) leaves the mark off. `patch()` then passes the changed paths of the chosen row bindings, and `patchList` skips a kept row whose item is the same reference when every chosen binding is marked and each changed path it reads is under the list's item. The index reads the list path itself, so it already counts as outside.

The client code for the skip measured about 90 B gzip on the todo loader; the loader is 4029 B without it.

## Affected nodes

`compile-view-codegen` (the mark), `patch-bindings`, `patch-lists`.

## Decision

Filled in by the orchestrator.
