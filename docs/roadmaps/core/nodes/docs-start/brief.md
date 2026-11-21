---
id: docs-start
title: Guide: getting started, components and state, views
status: active
priority: should
type: docs
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
verify: pnpm --filter website check:samples && pnpm --filter website build
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - website/docs/getting-started.md
  - website/docs/components.md
  - website/docs/views.md
  - website/docs/resuming.md
shared: []
reserves: []
provides: []
depends_on:
  - on: website-scaffold
    kind: hard
    why: adds Markdown pages that the scaffold's build, sidebar and sample checker process
  - on: example-todo
    kind: hard
    why: the pages explain the working todo app and its resume behavior
---

# Guide: getting started, components and state, views

## Goal

Four pages for a new user: install and run the todo app (`getting-started`), a module as a function component with `let`, `const`, handlers and `return` (`components`), the markup DSL with `#if`, `#for`, `#switch`, `#try` and holes (`views`), and what resumes and what loads on the first click (`resuming`).

## Context

- Source: `docs/proposals/0002-modules.md` (components, state, handlers), `docs/proposals/0005-markup.md` and the `markup-grammar` contract (views), `examples/todo`, `docs/proposals/0001-dsl.md` (what is plain data).
- Pages use `idlip` blocks. Every block compiles under `check:samples`. Use `no-check` only for deliberate errors.
- Read the outcomes of `markup-frontend` and `example-todo`; the code in the pages comes from `examples/todo`, not from memory.
- Rules of the closed hole grammar are in the analyzer errors; list the common ones with their ids.

## Acceptance

- [ ] The four pages exist with front matter and appear in the sidebar in learning order.
- [ ] A reader can follow `getting-started` from an empty folder to a running todo app; the commands were run once to confirm.
- [ ] Every code block compiles: `pnpm --filter website check:samples`.
- [ ] The `resuming` page names the real chunk and request counts from the `example-todo` e2e test.
- [ ] `pnpm --filter website build` passes; `pnpm format:check` passes.

## Sizing

M: four pages, about 800 lines of prose and samples. Verifiability is a check script plus a read-through.

## Notes for the worker

- Follow the plain-writing skill. Short sentences, no metaphors, no em-dashes.
- Do not describe features that have no merged node yet. Effects, subscriptions, refs and nesting have their own nodes.
- Do not edit the sidebar; front matter drives it.

## Updates after wave 9

- Form fields are plain event paths (`e.currentTarget.elements.draft.value`) and a `submit` is always prevented: use `form-fields` for the page, not the 0003 text. `$form` is gone.
- Name these analyzer ids in the common-errors list: `event-computed-key`, `event-placeholder`, `html-trusted`, `attr-event`, `srcdoc-trusted`, `hole-dynamic` (only where a dynamic path set cannot be bound).
- Views with a helper that takes the whole model or `props` are now accepted (`dynamic-paths`), so do not list them as errors.
- The `resuming` page may show the optional preload (`renderPreload`) as the way to make the first click request nothing. It is off by default: the page and the e2e count stay at the loader only.

## After debate `debates/dsl` (2026-11-21)

TSX stays the one source syntax. Pages and examples use `*.idlip.tsx`; no markup DSL, no `@idlip/language-core` or `@idlip/tsc`.
