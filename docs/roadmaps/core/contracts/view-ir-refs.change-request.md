# Change request: view-ir, ref-key and Dom call rules

From: `dom-refs`. Target: the diagnostics table of `contracts/view-ir.md`.

Status: applied on 2026-11-21 by the curator, from the code on `batch/core`

## Change

- Add the view rule `ref-key` (error): the tuple key of a `ref` inside `<For>` must be the item's `key` field of the innermost `<For>`, such as `ref={['row', t.id]}` under `key="id"`. `ref-form` stays for other forms.
- Add the handler rule `dom-call-position` (error): `Dom.focus`, `Dom.scrollIntoView` and `Dom.reset` must be a statement of their own, since they run after the patch and have no value.
- The IR is unchanged: `Ref` already has `name` and `tuple`.

## Why

The attribute is written once with the row, so a key that is not the row key would go stale when rows reorder.
