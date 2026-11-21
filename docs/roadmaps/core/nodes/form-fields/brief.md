---
id: form-fields
title: Form fields in event arrows
status: active
priority: should
type: feature
story:
early: false
outline: false
milestone: apps
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter idlip test -- form
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-20
spent:
owns:
  - packages/idlip/src/compiler/view/codegen/events.ts
  - packages/idlip/test/compiler/view/form*.test.ts
  - packages/idlip/test/fixtures/form/**
  - packages/idlip/test/client/loader/form.test.ts
shared:
  - packages/idlip/src/compiler/view/analyze/analyze.ts
  - packages/idlip/src/compiler/view/analyze/ir.ts
  - packages/idlip/src/compiler/view/analyze/print.ts
  - packages/idlip/src/core/format.ts
  - packages/idlip/src/client/loader/listener.ts
reserves: []
provides: []
depends_on:
  - on: dom-refs
    kind: behavior
    via: core-api
---

# Form fields in event arrows

## Goal

Redesign and implement the Form fields section of `docs/proposals/0003-update-analysis.md` for event arrows (`docs/proposals/0002-modules.md`, revised 2026-11-21). The `event.form` placeholder no longer exists, and the `form` root of the IR and `["$form", name]` in `format.ts` are unused leftovers.

## Context

- Recommended design, to confirm in the change request: a submit arrow reads fields as property paths on the event, for example `(e) => add(e.currentTarget.elements.draft.value)`. The listener already resolves `["$event", ...]` paths at dispatch (`listener.ts`), and a property path through `elements` works on `HTMLFormControlsCollection` with no new loader code. Check what the closed event-path grammar in the analyzer allows and widen it for `elements.<name>.value`, `.checked` and `.valueAsNumber`; reject a computed key.
- Default `preventDefault()` on `on:submit`: have the compiler add the existing `prevent` modifier, so the listener needs no change.
- `Dom.reset` and `Dom.focus` took a ref name in `dom-refs` (landed); the proposal's selector forms are obsolete. Update the 0003 section text through the change request, do not edit the proposal.
- Remove `["$form", name]` from `format.ts` and the `form` root from `ir.ts` and `print.ts` if the design above holds, or keep it for `event.form.all` if you choose that.

## Loader budget

Target flag-off cost 0 B and no flag: the design above adds no loader code. If a design needs listener code, it needs `HAS_FORM`, at most 10 B flag-off, and the listener script must stay under 1024 B gzip.

## Acceptance

- [ ] A form with `on:submit` reads a field at dispatch (test with the real listener and loader in happy-dom): the message payload holds the field value and the default is prevented.
- [ ] A computed key (`elements[name]`) is a compile error with a rule id.
- [ ] The todo loader and listener sizes are unchanged (e2e budget test).
- [ ] Fast check passes: `pnpm --filter idlip test`
- [ ] Change request: `contracts/compiled-format-form-fields.change-request.md` and `contracts/view-ir-form-fields.change-request.md`.

## Sizing

Mostly analyzer and codegen work on a narrow path grammar; the loader is untouched.

## Notes for the worker

- A field value belongs in the model only when the view reads it; the DOM keeps it across resume.

## Orchestrator decision (one-shot run)

Reading fields through `e.currentTarget.elements.<name>.value` is accepted. The user can revisit.
