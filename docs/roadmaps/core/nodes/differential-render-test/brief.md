---
id: differential-render-test
title: Compare the server render and the browser render of every fixture
status: done
priority: must
type: test
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
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-22
spent: 476000
owns:
  - packages/idlip/test/differential/**
shared:
  - packages/idlip/test/fixtures/**
  - packages/idlip/src/testing/**
reserves: []
provides: []
depends_on:
  - on: plain-tsx
    kind: hard
    why: uses the renamed fixtures
---

# Compare the server render and the browser render

From `brumate-lessons` row 8, approved by the user on 2026-11-22. Brumate rendered 525 pages both ways and found 43 that differ, from 17 causes, 11 of them bugs (see `/Users/alexis/Documents/GitHub/brumate`: its `differential-render-test` node outcome and test). idlip has no such test, and `cloned-templates` adds a second client render output, so this lands first.

## Do

- For each fixture and example, and several model states per fixture (initial, after each handler, and generated states where the model shape allows a small property-based generator), render the markup on the server and through the client chunks: a branch or row through its binding or list chunk, a child through its `view` chunk. Use happy-dom or the existing harness in `src/testing`.
- Normalize what may legitimately differ (attribute order, markers the client omits once `cloned-templates` or `text-anchor` land) and compare.
- Keep a list of accepted divergences, each with a reason. An accepted divergence that no longer occurs fails the test, so the list only shrinks.
- List the bugs found in outcome.md. Fix small render bugs in their own commits; list larger ones for the orchestrator.

## Acceptance

- Runs in `pnpm --filter idlip test` in under 30 s.
- Covers conditions, lists (create, append, reorder), children, `<Try>`, raw HTML and SVG.
