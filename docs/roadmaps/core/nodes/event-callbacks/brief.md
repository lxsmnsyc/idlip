---
id: event-callbacks
title: Event arrows compile to functions in the handler chunk
status: done
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
added: 2026-11-23
spent: 620000
owns:
  - packages/idlip/src/compiler/view/codegen/events.ts
  - packages/idlip/src/compiler/update/**
  - packages/idlip/src/client/loader/**
  - packages/idlip/test/compiler/update/**
  - packages/idlip/test/client/**
shared:
  - packages/idlip/src/compiler/view/**
  - packages/idlip/src/compiler/*.ts
  - packages/idlip/src/client/**
  - packages/idlip/src/core/**
  - packages/idlip/src/vite/features.ts
  - packages/idlip/test/**
  - website/docs/**
  - website/src/**
  - examples/**
  - benchmarks/idlip/**
  - e2e/**
  - docs/roadmaps/core/contracts/**
reserves: []
provides: []
depends_on:
  - on: shared-templates
    kind: hard
    why: both rewrite the view codegen; event writes in cloned templates (setOn$) change here
---

# Event arrows compile to functions in the handler chunk

User decision (2026-11-23), before 0.1. Refs stay string names (no change to `ref=` or `Dom.*`).

Today an event attribute is data in the HTML: the handler name and a payload of literals, values computed at render (row keys) and `["$event", ...path]` reads that the loader resolves while the event dispatches, with `prevent`/`stop` flags. That limits an arrow to one handler call, fixed field names (`event-computed-key`), and puts JSON payloads in the HTML.

New shape, following brumate (`/Users/alexis/Documents/GitHub/brumate/website/docs/markup.md`, "Events" and "Before the handler loads"; `packages/brumate/src/runtime/loader.ts`):

- An event arrow compiles to a function in the handler chunk, `(event, model, row) => ...`, that computes the message(s) from the event, the model and the row scope. The update still receives plain data: the message log, replay, devtools, `mount` tests and the state script do not change shape.
- Work that must happen while the event dispatches stays declarative and compiler-extracted: leading `e.preventDefault()` / `e.stopPropagation()` become flags, as now; `submit` stays always prevented. A conditional prevent (only some keys) needs an explicit form; read brumate's `prevent(handler, ...keys)` and propose the idlip TSX form in a change request (no compile-time marker APIs: see the user's rule in memory, function components with plain code).
- The loader records `currentTarget` at dispatch and passes it with the event, since the browser clears it after dispatch.
- Row values (`() => toggle(t.id)`) are read from the model by the row key at event time, not rendered into the attribute. A bare handler (`on:click={increment}`) and handlers passed to children as props (nesting) keep working.
- The HTML attribute shrinks to what the loader needs to find and run the function.

Read first: `contracts/compiled-format.md` (event attribute, manifest), `contracts/view-ir.md` (event rules), `website/docs/views.md` (event table and errors), `website/docs/forms.md`, `website/docs/global-events.md`, `website/docs/nesting.md`, outcomes of `global-events`, `form-fields`, `nesting`, `shared-templates`. Write change requests for compiled-format and view-ir; do not edit the contracts.

## Do, in this order (each its own commit, differential test green at each)

1. Change requests: the new attribute, the function export in the handler chunk, the loader call, prevent/stop flags, conditional prevent form, row lookup.
2. Compiler: emit the event functions; lift the one-call and fixed-path limits (arrows may branch and call more than one handler, or none); keep errors for what cannot work lazily (reading the event after an `await`, calling `preventDefault` conditionally without the explicit form).
3. Loader: dispatch, `currentTarget`, flags, row lookup. Loader budget 4096 B gzip (about 3991 B now); report the size.
4. Global events, `<Subscribe>` element events, forms and nesting props on the same path.
5. Docs: views, forms, global events, nesting, reference; live samples still run.

## Acceptance

- `on:keydown={(e) => { if (e.key === 'Enter') submit(e.currentTarget.value) }}` and an arrow that calls two handlers compile and run, with tests and a differential subject.
- No `$event` path payloads in compiled HTML; a test checks the fixtures.
- Server HTML size, first click and rows/dashboard numbers before/after in outcome.md; nothing slower beyond noise.
- Build, unit, differential, e2e, website tests, lint and format pass.

Landed as ec2ebee..3eb79dc on `batch/core` after one fresh review round (row lookup stops at the component boundary; event functions fold into `manifest.handlers` and load every tag at once). Todo loader 4087 B gzip.
