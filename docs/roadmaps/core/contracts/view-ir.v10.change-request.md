# Change request: view-ir v9 to v10

- From node: for-key-callback
- Status: proposed. The code on `node/for-key-callback` follows it.

## Problem

The `for` node has `key: string`, the field name from `key="id"`. The key is now a callback of the item.

## Proposed change

- `for.key` is `ForKey = { kind: 'field'; field: string } | { kind: 'computed'; expr: Expr }`.
- `field`: the body is a path of one field of the item. `computed`: any other expression of the closed grammar that reads the loop item and globals only (no state, props, index, `call`, `object` or `array`, no computed path segment).
- The printed IR shows `key=id` for a field and `key={<expr>}` for a computed key.
- Diagnostic `for-key` now covers: `key` that is not an arrow with one plain parameter and an expression body (the message names the callback form and, for `key="id"`, gives the replacement), and a body that reads more than the item.
- `ref-key` for a tuple ref inside a `<For>` with a computed key.
