# Change request: kept rows whose item did not change

- From node: perf-list-kept
- Status: proposed. The code in `client/patch/patch.ts` and `client/list/index.ts` already works this way.

## Problem

Behavior, "patchList": "A row binding whose group was chosen by this patch runs on every kept row of its list, whether or not the row's item changed, because its paths may include state outside the list". On the rows benchmark that means swap, remove, update every 10th and append run the row bindings on all 1,000 kept rows, though at most 100 items changed. The profile puts 4 to 9 ms of script a click there (`log.md`).

## Proposed change

Replace the sentence with: "A chosen row binding runs on a kept row whose item changed. It runs on every kept row of its list when a path of its group that is not under the list's item (`<list path>.*`) changed, such as `selected` in `class={selected === t.id}` or the list path itself, which an index read gives. A kept row whose item is the same reference runs no binding otherwise."

`patch()` decides this per list from `manifest.groups` (each group's `paths` are the paths of each of its `bindings`) and the changed paths, and passes it as a new optional field of the context:

```ts
interface RowContext extends ListContext {
  /** True when each chosen row binding changed only through paths under its list's item. */
  readonly items?: boolean;
}
```

Absent or false keeps the v9 behavior, so a direct caller of `patchList` with a plain `ListContext` gets what it got before. `RowContext` lives in `client/patch/patch.ts`; `ListContext` in `core/format.ts` did not change.

## Assumptions

- Every binding a chunk exports is in the `bindings` of some group. Checked on the 92 row bindings of the differential subjects, the todo example and the benchmark apps.
- A list with no `path` (its `each` is a call) compares paths against `undefined.*.`, which no state name starts, so its row bindings always run on every kept row.

## Affected nodes

`patch-bindings`, `patch-lists`. No compiler change.

## Decision

Filled in by the orchestrator.
