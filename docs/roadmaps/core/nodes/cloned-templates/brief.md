---
id: cloned-templates
title: Clone a <template> for new branches and rows instead of parsing HTML strings
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
  - packages/idlip/src/client/loader/**
  - packages/idlip/test/fixtures/**
  - benchmarks/**
  - e2e/**
reserves: []
provides: []
depends_on:
  - on: plain-tsx
    kind: hard
    why: edits the renamed fixtures and expected outputs
---

# Clone a <template> for new branches and rows

A branch that appears after a click (`{open && <section>...}`) and a new `<For>` row are rendered in the browser from an HTML string: the binding or list chunk builds the string with the model values, and the client parses it (`parseHtml` in `src/client/patch/dom.ts`, one `<template>` + `innerHTML` per row), then walks the result for markers (`findInnerBlocks`, `collectBlocks`). Profiles from `bench-rows` and `perf-list-create`: `parseHtml` is 6.3 to 8.1 ms of 12.9 to 16.5 ms script when creating 1,000 rows. Rows benchmark: create 1,000 rows 35.4 ms vs brumate 0.8.1 22.1 and Marko 6 21.0; append 2.0x and 2.2x behind. `perf-list-create` tried one parse for all rows and found the gain within noise (the native parser dominates).

Brumate had the same design and moved away from it. Read first:
- brumate commit `4b5e93a3` ("the browser clones a template for the body of an #if or a #for") in `/Users/alexis/Documents/GitHub/brumate`: `git show 4b5e93a3`, especially `packages/brumate/src/codegen/template.ts` and the `runtime/client.ts` changes. Its result: create 1,000 rows 8.0 to 5.3 ms of script, replace 15.1 to 11.4 ms.
- `/Users/alexis/Documents/GitHub/brumate/docs/performance.md`, "Client updates" and "Templates".

## Do

- A branch or row body whose markup is static elements, attributes, element text and holes compiles to a static `<template>` HTML plus a list of writes per marked element (text, attribute, event message, nested block anchor). The chunk creates the template once (lazily, per chunk), clones it per render, and writes the values on the marked elements found by index or by a precomputed child path. No HTML string is built or parsed per render.
- Keep element references from the clone where the bindings need them, so client-created rows need fewer or no comment markers (`<!--t2-->`) and no marker walk. Server-rendered rows keep their markers for resuming.
- Event attributes on cloned elements: the document listener reads `on:click` messages; write them per clone (or find a cheaper form; measure).
- Bodies with children components, `<Try>`, raw HTML, `<Subscribe>`, head, SVG/MathML namespaces fall back to the string path at first, unless cheap to cover. List what falls back in outcome.md.
- Loader size: the todo loader budget is 4096 B gzip (`e2e/tests/todo.spec.ts`, `loaderBudget`). Put the clone path behind a feature flag in `vite/features.ts` if it grows the loader, or move code from the loader into chunks. If the budget cannot hold, stop and report numbers; do not raise it on your own.
- Use the perf-pass skill: profile before and after with `benchmarks/harness/profile-rows.mjs`, A/B with `bench.py`, load average under 3.

## Acceptance

- Create 1,000 rows, replace, append and create 10,000 rows faster by more than the noise, before/after in outcome.md. The disclosure case (a branch shown on click) renders through a clone, with a test.
- Server and client renders agree (an existing differential test, or add one as brumate's `differential-render-test` did).
- `pnpm --filter idlip test` and the e2e todo spec pass; loader budget holds.
