---
id: safe-urls
title: Block javascript URLs in URL attributes
status: done
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
spent: 93333
owns:
  - packages/idlip/test/security/**
  - packages/idlip/src/core/url.ts
shared:
  - packages/idlip/src/compiler/view/codegen/html.ts
  - packages/idlip/src/client/patch/nodes.ts
reserves: []
provides: []
depends_on:
  - on: svg-and-html
    kind: hard
    why: edits the same attribute emission and the SVG attribute types
---

# Block javascript URLs in URL attributes

## Goal

The `svg-and-html` security review found that `href`, `src`, `action`, `formaction`, `xlink:href` and other URL attributes accept `javascript:` values from model data with no check, on the server render and in client patches. A view that binds user data into a link is then an XSS vector. Prove it with a failing test first, then make URL attributes with a dynamic value reject `javascript:` (and `vbscript:`, `data:` except images if needed) at render and patch time, as React and Solid do (check brumate in `../brumate` for its rule). Static literal values written by the developer stay allowed. Keep loader cost small; report it.

## Acceptance

- [x] A test binds `javascript:alert(1)` from the model into `href` on `<a>` and on SVG `<a>`, on the server render and after a client patch; it fails on the base and passes on the branch (the value is replaced or the attribute dropped, with a dev warning).
- [x] A static `href="javascript:void(0)"` written in source keeps working, or is a compile error; pick one and document it.
- [x] Todo loader stays under 4096 B gzip.

## Sizing

S: one URL check shared by server and client.

Landed as 7ab212d on `batch/core`. Proof: `javascript:alert(1)` from the model stayed in `href` on the server and after a patch on the base; dropped with a dev warning on the branch. Static literals in source are not checked. Loader unchanged (the check lives in chunks). Follow-up: `safe-urls-2`.
