---
id: safe-urls-2
title: Close the remaining URL attribute gaps
status: active
priority: should
type: fix
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
verify: pnpm --filter idlip exec vitest run test/security
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - packages/idlip/test/security/**
  - packages/idlip/src/core/url.ts
shared:
  - packages/idlip/src/compiler/view/codegen/html.ts
  - packages/idlip/src/jsx/elements.ts
reserves: []
provides: []
depends_on:
  - on: safe-urls
    kind: hard
    why: extends its URL check
---

# Close the remaining URL attribute gaps

## Goal

`safe-urls` blocks `javascript:` and `vbscript:` in bound URL attributes. Its outcome lists gaps: SVG animation attributes (`to`, `values`, `from`, `by` when `attributeName` is `href`), `srcdoc` on `iframe`, and `data:` URLs in `iframe`, `object` and `embed`. Prove each with a failing test, then close it (reject `srcdoc` unless the value is `trusted(...)`, treat animation targets of URL attributes as URL attributes, block `data:` except image types where it is a known safe use). Also add the missing JSX types it worked around (`formaction` on `<button>`, `xlink:href` on SVG `<a>`) and drop the `@ts-nocheck` in `test/security/urls.idlip.tsx`.

## Acceptance

- [ ] Each gap has a test that fails on the base and passes on the branch.
- [ ] `test/security/urls.idlip.tsx` type checks without `@ts-nocheck`.

## Sizing

S: extends one check.
