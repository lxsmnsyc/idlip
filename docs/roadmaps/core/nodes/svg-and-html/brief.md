---
id: svg-and-html
title: SVG and MathML namespaces, and trusted raw HTML
status: todo
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
size: S
spike: false
hypothesis:
verify: pnpm --filter idlip test -- svg raw-html
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-20
spent:
owns:
  - packages/idlip/src/client/html.ts
  - packages/idlip/src/compiler/view/codegen/raw.ts
  - packages/idlip/test/svg/**
  - packages/idlip/test/raw-html/**
  - packages/idlip/test/fixtures/svg/**
shared:
  - packages/idlip/src/compiler/view/codegen/plan.ts
  - packages/idlip/src/compiler/view/codegen/html.ts
  - packages/idlip/src/compiler/view/codegen/chunks.ts
  - packages/idlip/src/client/patch/dom.ts
  - packages/idlip/src/client/list/index.ts
  - packages/idlip/src/client/features.ts
  - packages/idlip/src/vite/features.ts
reserves: []
provides: []
depends_on:
  - on: compiled-format
    kind: contract
    via: compiled-format
  - on: loader-trim
    kind: hard
    why: loader budget: this node adds loader seams, so it starts after the flag-off seams are trimmed
---

# SVG and MathML namespaces, and trusted raw HTML

## Goal

Finish and prove the namespace and raw HTML cases. Much exists: the IR records `namespace` on `for` and `condition` nodes, `chunks.ts` passes it to `setBranch$` and exports `namespace` from list chunks, `parseHtml(doc, html, ns)` wraps in `<svg>` or `<math>`, and the analyzer has `html-trusted` and `html-children`. What is left is the test coverage and the missing parts.

## Context

- Source: `docs/proposals/0004-effects-refs-errors.md`, SVG, MathML and raw HTML.
- Check each case with the real loader: a `<For>` inside `<svg>` creates rows with the SVG namespace on the client; a condition inside `<math>`; `<foreignObject>` returns children to HTML (view-ir). Fix what fails.
- `html={trusted(x)}`: the server writes the string as is. The patcher must set `innerHTML` through the `idlip` Trusted Types policy that `parseHtml` already uses. A binding chunk may not import more than the loader holds, so the setter is loader code.

## Loader budget

The `innerHTML` setter goes behind `HAS_HTML` (detector: a binding of kind html in some manifest; reuse the group or binding kind the codegen emits). Flag-off cost at most 5 B. Flag-on cost reported; expect 60 B. The namespace paths already in the loader are not part of this budget; if `loader-trim` finds they can sit behind a flag, report it as an open question.

## Acceptance

- [ ] A client-created row inside `<svg>` has the SVG namespace (`namespaceURI`), and in `<math>` the MathML one.
- [ ] `html={trusted(s)}` renders on the server and patches `innerHTML`; a plain string is a type error (type test) and children are rule `html-children`.
- [ ] The todo loader grows by at most 5 B (e2e budget test).
- [ ] Fast check passes: `pnpm --filter idlip test`
- [ ] Change request: `contracts/compiled-format-html.change-request.md` only if the binding kind needs a contract line.

## Sizing

Verification of landed pieces plus one gated setter.

## Notes for the worker

- Trusted Types: the policy is already created in `dom.ts`; reuse it, do not make a second.
