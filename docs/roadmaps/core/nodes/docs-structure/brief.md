---
id: docs-structure
title: Review the structure of the docs
status: todo
priority: should
type: docs
story:
early: false
outline: false
milestone: '0.2'
target:
ship: pr
land: auto
from:
size: M
spike: true
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-11-24
spent:
owns:
  - docs/roadmaps/core/nodes/docs-structure/**
shared: []
reserves: []
provides: []
depends_on: []
---

# Review the structure of the docs

## Goal

Review how the docs in `website/docs/` are organized, and propose a structure: the sections, the pages in each, their order, and the pages to split, merge, add or drop. The result is a proposal for the user, not a rewrite. A follow-up node moves the pages once the user approves.

## Context

The docs grew one page per feature node, and nobody has looked at them as a whole since. The sidebar comes from each page's `section` and `order` front matter (`website/README.md`). As of 2026-11-24:

- Start: Introduction (0), Getting started (1).
- Guide, 21 pages in one flat list: Components and state (10), Views (11), Resuming (12), Nesting (13), Styles (14), Component packages (15), What runs where (16), Document head (20), SVG, raw HTML and URLs (21), Forms (22), Errors (23), Dynamic paths (24), Testing (25), Deploying (26), Effects (30), Subscriptions (31), Refs (32), Window and document events (33).
- Tools: Editor setup (90), Benchmarks (91).
- Reference: `idlip`, `idlip/server`, `idlip/client`, `idlip/compiler`, `idlip/vite`, `idlip/testing`, `idlip/jsx-runtime`, Component syntax.

Some possible problems, to confirm or reject with evidence, not to take as given: one Guide section is long to scan; Deploying and Testing sit between feature pages; Effects, Subscriptions and Refs come after Deploying; "What runs where" and "Resuming" explain the model but sit among feature pages.

## Steps

- [ ] Read every page. For each, note its job (tutorial, concept, how-to, reference), what it assumes the reader knows, and the pages it links to.
- [ ] Find the reading paths of a new user (first app to deploy) and of a returning user (looking up one API). Note where a page needs a concept that a later page explains.
- [ ] Find overlaps (the same topic explained on two pages) and gaps (a shipped feature or error code that no page covers). Check the gaps against `packages/idlip/src` and the reference pages.
- [ ] Look at the structure of two or three comparable framework docs for the section split. Cite them.
- [ ] Write the proposal in `outcome.md`: the new sidebar as a list (section, page, order), a table from each current page to its new place, and the split, merge, add and drop changes with one reason each.

## Acceptance

- [ ] `outcome.md` has the proposed sidebar, a mapping of every current page (none left out), and the evidence for each change.
- [ ] Every gap names the feature and where it lives in the code.
- [ ] No file in `website/` changes in this node.

## Sizing

M: reading about 30 pages and the reference, no code. The output is one document.

## Notes for the worker

- Gate: the user reviews the proposal before any page moves. Do not edit `website/docs/`.
- `site-components` rewrites the sidebar code but keeps the front matter, so the proposal works the same before or after it.
- Follow the plain-writing skill for the proposal.
