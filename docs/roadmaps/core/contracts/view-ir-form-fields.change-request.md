# Change request: view-ir, form fields

From: `form-fields`. Target: the `Root` type and the diagnostics table of `contracts/view-ir.md`.

Status: applied on 2026-11-21 by the curator, from the code on `batch/core`

## Change

- Remove `{ kind: 'form'; name: string }` from `Root` (done in `ir.ts` and `print.ts`).
- Add the event rule `event-computed-key` (error): an event argument reads event fields by a fixed name, so `e.currentTarget.elements[name].value` is rejected.
- `Event.modifiers` of an element `submit` event always holds `prevent` unless it is a forwarded message prop. The IR shape is unchanged.

## Why

A field is a property path on the event, so no root of its own is needed.
