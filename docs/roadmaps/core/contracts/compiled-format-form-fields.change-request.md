# Change request: compiled-format, form fields

From: `form-fields`. Target: Placeholders, Modifiers and the reserved list of `contracts/compiled-format.md`.

Status: applied on 2026-11-21 by the curator, from the code on `batch/core`

## Change

- Remove `["$form", name]` from the Placeholders paragraph, from the list of reserved items and from `Payload` in `format.ts` (done in `core/format.ts`).
- A form field is an ordinary `$event` path. `on:submit={(e) => add(e.currentTarget.elements.draft.value)}` writes `["$event","currentTarget","elements","draft","value"]`. The listener resolves it with the existing reduce, and `HTMLFormControlsCollection` answers a name lookup as a property. The listener and loader are unchanged (no `HAS_FORM` flag, 0 B).
- The compiler adds `prevent` to every element `on:submit` that is an arrow or a handler of this module and does not have it. The encoding stays `["add",[...],"prevent"]`. No source form gives `passive`, so the rule has no exception. A forwarded message prop (`on:submit={props.onSend}`) keeps the modifiers of the parent's message: the compiler adds nothing to it.
- Only the fixed names `elements.<name>.value`, `.checked` and `.valueAsNumber` are documented. Any property path on the event is accepted, as before. A computed segment is the rule `event-computed-key` (was `event-placeholder`).

## Why

The orchestrator decision of the one-shot run: fields are read as event paths. No new placeholder, so no loader cost.
