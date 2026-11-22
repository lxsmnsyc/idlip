---
id: cloned-templates-all
title: Clone templates for every block body except raw HTML
status: todo
priority: must
type: feature
story:
early: false
outline: false
milestone: 0.1
target:
ship: auto
land: auto
from:
size: L
spike: false
hypothesis:
verify: pnpm --filter idlip build && pnpm --filter idlip test
exclusive: [benchmark]
fulfilled_by:
gate: false
added: 2026-11-22
spent:
owns:
  - packages/idlip/src/compiler/view/codegen/**
  - packages/idlip/src/client/list/**
  - packages/idlip/src/client/patch/**
  - packages/idlip/test/compiler/view/codegen/**
  - packages/idlip/test/client/**
shared:
  - packages/idlip/src/core/helpers.ts
  - packages/idlip/src/vite/features.ts
  - packages/idlip/src/client/**
  - packages/idlip/test/differential/**
  - packages/idlip/test/fixtures/**
  - benchmarks/**
  - e2e/**
  - docs/roadmaps/core/contracts/**
reserves: []
provides: []
depends_on:
  - on: cloned-templates
    kind: hard
    why: extends the clone path it adds
  - on: shared-helpers
    kind: hard
    why: both rewrite chunk code; shared-helpers removes the copied clone helpers first
---

# Clone templates for every block body except raw HTML

User decision (2026-11-22): after `cloned-templates`, the remaining bodies that render through HTML strings move to cloned templates too, before 0.1. Only raw HTML (`html=`) stays a string, and only its own content: the element around it is cloned.

Read first: `nodes/cloned-templates/outcome.md` (what falls back and why), `nodes/shared-helpers/outcome.md`, brumate's later template work (`git -C /Users/alexis/Documents/GitHub/brumate log --oneline | grep -i template`, especially nested blocks and children).

## Do, in this order (each its own commit, each keeps the differential test green)

1. **Nested lists and conditions inside a row or branch**: nested templates or anchors the inner block renders into; the inner block uses the clone path too.
2. **Child components inside a row or branch**, and a child's own `view` chunk render: its root is a template.
3. **SVG and MathML bodies**: parse the template inside an `<svg>` or `<math>` wrapper for the namespace.
4. **Text holes in `<script>`, `<style>`, `<textarea>`, `<title>`, `<pre>`** (raw-text and newline rules): write the element's `textContent`/`value` instead of a comment-marked text node.
5. **Text holes directly under table elements or `<select>`**: anchor on the parent element instead of a comment marker, so the parser's foster-parenting cannot move it.
6. **`<Try>`, `<Subscribe>`, `<Head>`, `<window>`/`<document>` listeners** inside bodies: teach the template writer their markers.
7. **Dynamic holes** (read paths known only at run time).
8. **Bodies with nothing to write**: clone a cached static fragment instead of parsing each time.
9. **Raw HTML**: clone the surrounding element; parse only the raw content.

## Constraints

- The differential render test must pass at every commit; add a subject per case.
- Loader budget 4096 B gzip (feature flags for new loader code); report sizes per step.
- Profile and A/B (fixed N chosen before running, load < 3) on the rows and dashboard benchmarks at the end; nothing must get slower beyond noise.

## Acceptance

- Only raw HTML content is parsed from a string in the browser; a test greps compiled chunks of every fixture for the string render path and allows only `html=` content.
- Differential test, e2e and benchmark builds pass; before/after numbers in outcome.md.
