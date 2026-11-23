---
id: fix-style-object
title: Style objects render as CSS text
status: done
priority: must
type: fix
story:
early: false
outline: false
milestone: '0.1'
target:
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify: pnpm --filter idlip test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-23
spent: 83000
owns:
  - packages/idlip/test/style-object/**
shared:
  - packages/idlip/src/compiler/**
  - packages/idlip/src/server/**
  - packages/idlip/src/client/**
  - packages/idlip/src/jsx/**
  - website/docs/styles.md
reserves: []
provides: []
depends_on: []
---

# Style objects render as CSS text

`style={{ color: x, '--size': n }}` renders `style="[object Object]"` on the server (found in the component-styles review, 2026-11-23). React and Solid users write style objects by habit, so this is a bug, not a missing feature.

## Do

- A `style` attribute whose value is an object renders as CSS text on the server and patches on the client: keys written as given when they start with `--`, camelCase keys turned into kebab-case otherwise, `null`/`undefined`/`false` values dropped, numbers written as given (no automatic `px`; say so in the docs). A string value keeps working as today.
- Static objects fold to a string at compile time. Dynamic ones convert at render and in the binding chunk. Keep the conversion helper out of the loader unless a page uses a dynamic style object (feature flag or helper module), and confirm the loader size is unchanged for pages that do not.
- The JSX types accept `string | Record<string, string | number | null | undefined | false>` for `style`.
- Escape values the same way other attribute values are escaped.
- Update `website/docs/styles.md` to show both forms.

## Acceptance

- Tests: static object, dynamic object updated on click, custom property, camelCase key, dropped `null`, string form unchanged, and a differential server-vs-client check if the repo has one for attributes.
- Loader size unchanged for the todo example; `pnpm test`, typecheck, lint, format check and website build pass.

Landed 2026-11-23 on batch/core: `joinStyle$` in the shared helpers, literal objects fold at compile time, `StyleValue` type. Orchestrator review: values are not split on `;`, same as the string form.
