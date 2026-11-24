---
id: landing-components
title: Render the landing and REPL pages from idlip components
status: todo
priority: should
type: refactor
story:
early: false
outline: false
milestone: '0.2'
target:
ship: pr
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter idlip build && pnpm --filter website build && pnpm --filter website test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-24
spent:
owns:
  - website/src/landing/**
  - website/src/figures/**
  - website/src/repl/page.ts
shared:
  - website/src/pages/**
  - website/test/**
reserves: []
provides: []
depends_on:
  - on: site-components
    kind: hard
    why: reuses the document component, header and footer components and the build render that site-components creates
---

# Render the landing and REPL pages from idlip components

## Goal

Move the landing page (`website/src/landing/`: hero, resume, benchmarks, features, install), the docs figures (`website/src/figures/`) and the REPL page shell (`website/src/repl/page.ts`) from string-built HTML to idlip components, on the document component from `site-components`. After this, no site page is built as an HTML string.

## Context

- Read `nodes/site-components/outcome.md` for the components and the build render.
- The interactive parts (hero timeline, figures player, search, REPL) run from plain scripts in `website/src/client/`. Keep those scripts. This node changes only how the server markup is made. Moving the interactions onto idlip handlers is a separate decision.
- `website/src/repl/frame-document.ts` is the sandbox frame, not a page. Leave it.

## Acceptance

- [ ] No HTML string building in `landing/`, `figures/` or `repl/page.ts`, apart from Markdown and highlighter output passed through `html={trusted(...)}`.
- [ ] The landing, the REPL and every page with a figure look and work the same in `pnpm --filter website preview`. The hero timeline, the demo request panel and the figure player still run.
- [ ] `verify` passes, and `pnpm lint && pnpm format:check && pnpm typecheck` pass.

## Sizing

M: about 45 kB of string templates to port onto components that already exist. Low risk once `site-components` is done.

## Notes for the worker

- An idlip bug found here is its own fix node on `packages/idlip`.
- Run the website build locally; it is not in CI.
