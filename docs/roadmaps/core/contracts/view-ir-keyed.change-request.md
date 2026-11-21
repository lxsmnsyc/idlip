# Change request: view-ir v9 to v10

- From node: keyed-paths
- Status: open

## Problem

view-ir reserves the `keyed` segment and emits none. A hole such as `todos.find((t) => t.id === selected).text` is a `hole-method` error today, and `dynamic-paths` would otherwise have to resolve it.

## Proposed change

1. In Expressions, `list.find((p) => p.<field> === <expr>)` joins the grammar when `list` is a state or props path. Either side of `===` may hold the item field. The call lowers to a `path` expression: the list path plus `{ kind: 'keyed', field, value }`. Segments after it read the found item and are optional (`?.`), because `find` can return nothing. Other forms of `find` stay `hole-method`.
2. In Holes and paths, a path set keeps the `keyed` segment only when both hold:
   - the list is the `each` of a `<For>` in the module whose `key` equals `field`;
   - `value` is a path that starts at a state field and has field names only.

   Otherwise the segment becomes `*`, and the set also gets the path to the field. `todos.find((t) => t.id === selected).text` gives `selected, todos.*.id, todos.*.text` when no `<For>` keys `id`, and `selected, todos[id=selected].text` when one does. The paths of `value` are always in the set.

3. A path with a prefix in the set covers longer paths, and `todos` also covers `todos[id=selected].text`.
4. The printed form is `todos[id=selected].text`.

## Affected nodes

`dynamic-paths` (waits for this node), `keyed-writes`, `nesting-compile`, `form-fields` (all read `analyze.ts`).

## Workaround in place

Implemented in `analyze.ts` as `lowerFind` and `isKeyedList`. The analysis runs twice when a module has a `find` and a keyed `<For>`, because the `<For>` may come after the hole. A `<For>` over a loop-rooted list never keys a path.

## Decision
