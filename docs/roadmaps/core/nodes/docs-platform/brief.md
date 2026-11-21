---
id: docs-platform
title: Guide: head, SVG, forms, errors, testing, deploy
status: todo
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
  - website/docs/head.md
  - website/docs/svg-and-html.md
  - website/docs/forms.md
  - website/docs/errors.md
  - website/docs/dynamic-paths.md
  - website/docs/testing.md
  - website/docs/deploying.md
shared: []
reserves: []
provides: []
depends_on:
  - on: website-scaffold
    kind: hard
    why: adds Markdown pages that the scaffold's build, sidebar and sample checker process
  - on: docs-start
    kind: hard
    why: pages reuse the vocabulary of components and views
  - on: document-head
    kind: hard
    why: documents head management as built
  - on: svg-and-html
    kind: hard
    why: documents SVG and raw HTML as built
  - on: form-fields
    kind: hard
    why: documents form field placeholders and Dom commands as built
  - on: errors
    kind: hard
    why: documents error boundaries and handler error reporting as built
  - on: dynamic-paths
    kind: hard
    why: documents which views the analysis accepts
  - on: testing-mount
    kind: hard
    why: documents idlip/testing as built
  - on: deploy-skew
    kind: hard
    why: documents how cached pages survive a deploy
  - on: prefetch
    kind: hard
    why: documents prefetching as built
  - on: hmr
    kind: hard
    why: documents the dev server behavior on edits
---

# Guide: head, SVG, forms, errors, testing, deploy

## Goal

Seven pages for the rest of what 0.1 ships: `<head>`, SVG and raw HTML, form fields, errors, views with dynamic paths, testing with `idlip/testing`, and deploying (skew, prefetch, dev server).

## Context

- Source: the outcomes of each dependency, plus `docs/proposals/0003-update-analysis.md` and `docs/proposals/0004-effects-refs-errors.md`. The outcomes and the code win over the drafts.
- This node waits for the last feature nodes of the milestone, so it runs late. If one dependency is dropped or parked by the user, the matching page is dropped with it.

## Acceptance

- [ ] Seven pages with front matter, in the sidebar after the effects pages.
- [ ] Every sample compiles under `pnpm --filter website check:samples`, and names match the exports in `packages/idlip/src`.
- [ ] `deploying` gives the Vercel and Node setup that was run once from `examples/todo`.
- [ ] `pnpm --filter website build` and `pnpm format:check` pass.

## Sizing

M: seven short pages. Coupling is high (10 dependencies), but each is a read-only source of facts.

## Notes for the worker

- Short pages; link to the reference for signatures.
- Follow the plain-writing skill.
