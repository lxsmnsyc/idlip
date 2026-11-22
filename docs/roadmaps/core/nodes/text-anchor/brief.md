---
id: text-anchor
title: Patch a bound text that fills an element without comment markers
status: todo
priority: should
type: feature
story:
early: false
outline: false
milestone: 0.1
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter idlip build && pnpm --filter idlip test
exclusive: [benchmark]
fulfilled_by:
gate: false
added: 2026-11-22
spent:
owns:
  - packages/idlip/test/compiler/view/codegen/text-anchor*
shared:
  - packages/idlip/src/compiler/view/codegen/**
  - packages/idlip/src/client/patch/**
  - packages/idlip/src/server/**
  - packages/idlip/test/**
  - benchmarks/README.md
reserves: []
provides: []
depends_on:
  - on: cloned-templates-all
    kind: hard
    why: works on the same client render and list code
  - on: cloned-templates
    kind: hard
    why: both change how client-made markup is anchored
  - on: differential-render-test
    kind: hard
    why: guards the marker change
---

# Patch a bound text that fills an element without markers

From `brumate-lessons` row 6, approved by the user on 2026-11-22. Every bound text hole writes `<!--tN-->...<!--/t-->` (`compiler/view/codegen/html.ts:124-128`). Brumate `9317783c` dropped the markers for a text that is the only child of its element: HTML per todo 214 to 174 B (26 to 20 B gzip), core +77 B gzip. Rows page HTML: idlip 353.0 kB raw, Marko 6 269.4 kB.

## Do

- A hole that is the only child of an element is patched through the element (`textContent`, using the element's existing `i-a` index or a new one) and writes no comment markers, on the server and in client-made markup.
- Keep the markers where the hole has siblings.
- Check the loader budget (4096 B gzip for todo) before and after; use a feature flag if it grows.

## Acceptance

- Rows and todos SSR HTML raw and gzip before/after in outcome.md; keep only if raw shrinks and gzip does not grow.
- Differential test passes; e2e todo spec passes; loader budget holds.
