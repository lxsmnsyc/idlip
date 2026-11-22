# Change request: compiled-format v14 to v15

- From node: for-key-callback
- Status: proposed. The code on `node/for-key-callback` follows it.

## Problem

`ListEntry.key` is the name of one field, the string of `key="id"`. The user decided on 2026-11-22 that `<For>` takes its key as a callback, `key={(t) => t.id}`. A callback can return something that is not one field of the item, such as a template literal.

## Proposed change

- `ListEntry.key` is optional. It is the field name when the callback body is one field of the item (`t.id`). It is absent when the body is any other expression, and then the list chunk exports `key(item)`, compiled from the body.
- `ListChunk` gains `key?: (item) => unknown`.
- A list with a computed key still has `ListEntry.path`. Its row pairing in `patchList` loads the list chunk first and pairs rows with `chunk.key`. Every change of the list loads the chunk, since the key lives there.
- `DiffPaths` keys: `getListKeys` maps the list path to `undefined` for a computed key. A `*` path under such a list counts as changed when the list changed, because index pairing can miss a moved row.
- A computed key never appears in a manifest path: the analysis keeps a keyed segment (`todos[id=selected]`) only for a field key, and a `find` on a list with a computed key gives `*` plus the field path.
- Nested fields (`t.meta.id`) are computed keys in this version. The path form `todos[meta.id=...]` is not defined.
- The server writes no row key into the markup. A child inside a row takes the key from the same expression in `slot$`.
- New feature flag `HAS_KEY_FN` (+24 B gzip when on), on when any manifest list has no `key`.

## Contract text

ListEntry: `key` optional, with the rule above. ListChunk: add `key`. Version history: add a v15 line.

## Affected nodes

- `keyed-writes` (0.2): relies on a field key. See its note in `nodes/for-key-callback/outcome.md`.
