# Outcome: form-fields

## Built

- A submit arrow reads fields as event paths: `e.currentTarget.elements.draft.value`, `.checked`, `.valueAsNumber`. The path grammar already allowed them and the listener resolves them, so the loader and listener are unchanged.
- `analyze.ts`: an element `on:submit` gets the `prevent` modifier unless it has `prevent` (`addPrevent`). A forwarded message prop keeps the parent's modifiers.
- `codegen/events.ts`: a computed segment in an event path is the rule `event-computed-key`.
- Removed `["$form", name]` from `format.ts` and the `form` root from `ir.ts` and `print.ts`.
- `jsx/elements.ts`: `FormElement` and `FormField`. `on:submit` on a `<form>` has `currentTarget: FormElement`, whose `elements` is a record of named fields (`value`, `checked`, `valueAsNumber`).
- Tests: `test/client/loader/form.test.ts` (real listener and loader through `mount`, a form in a `<For>` row), `test/compiler/view/form.test.ts`, typed fixture `test/fixtures/form/form.idlip.tsx`.
- Change requests: `compiled-format-form-fields`, `view-ir-form-fields`. The 0003 Form fields text is obsolete (`event.form`, selector forms of `Dom.reset` and `Dom.focus`): replace it with the design above.

## Acceptance

- [x] A submit reads fields at dispatch and the default is prevented (loader test).
- [x] A computed key is `event-computed-key`.
- [x] Loader and listener sizes unchanged (e2e budget test).
- [x] `pnpm --filter idlip test` passes.
- [x] Both change requests written.

## Deviations

- `Dom.reset` and `Dom.focus` are untouched (done in `dom-refs`).
- The loader test uses `check: false`: the DOM holds field values the server render does not have, by design.
- Edited `src/jsx/elements.ts` (not owned) for the typed form element, as the coordinator asked.

## Stubs left

- None.

## Gotchas

- `FormElement` lists a few `HTMLFormElement` members, not all: `Omit<HTMLFormElement, ...>` collapses to its index signature.
- Any property path on the event is accepted, including `e.target.value`. Only a computed key is rejected.
- Every element `on:submit` with an arrow or local handler is prevented. A forwarded message prop is not.

## Proposed learnings

- None.

## Verification

- `pnpm --filter idlip test`: 564 passed. `pnpm build && pnpm --filter e2e test`: 14 passed. Lint and typecheck clean. Loader 3950 B gzip (unchanged, budget 4096).

## Size

- Estimated M, actual S: the grammar and the listener already supported the paths.
