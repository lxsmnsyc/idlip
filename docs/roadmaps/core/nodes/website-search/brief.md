---
id: website-search
title: Add search to the website
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
verify: pnpm --filter website build && pnpm --filter website test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-22
spent:
owns:
  - website/src/search/**
  - website/test/search*
shared:
  - website/src/layout.ts
  - website/src/site.ts
  - website/src/markdown.ts
  - website/src/client.ts
  - website/src/styles.css
  - website/vite.config.ts
reserves: []
provides: []
depends_on:
  - on: website-polish
    kind: hard
    why: the search bar sits in the header that website-polish restyles
---

# Add search to the website

## Goal

A search bar in the header that opens a command bar (also on `/` and Cmd or Ctrl+K). It finds guide and reference pages by title, heading and text, and jumps to the heading.

## Context

- Source: `~/Documents/GitHub/brumate/website/src/components/Search.brm` and `src/search-indexes.ts`. Brumate builds an index of page, heading, id and text entries at build time and loads it the first time the command bar opens. Copy that design. idlip's site is static TypeScript, not brumate components, so write it as plain DOM code in `website/src/search/`.
- Build the index from the pages `loadPages` already renders (`headings`, `description`, the text of each section). No search service and no network call besides the index file.

## Steps

- [ ] Build step: write `search-index.json` with one entry per heading (page, page title, heading, id, text with markup removed).
- [ ] Client: load the index on first open, rank title matches over heading matches over text matches, highlight the matched words, and show "No results for …" with a link to the guide when nothing matches.
- [ ] Keyboard: arrow keys move, Enter opens, Escape closes and returns focus to the search bar. The command bar is a modal dialog with a label.
- [ ] Also list the theme toggle and the REPL (if `website-repl` has landed) as commands.
- [ ] Tests: the index has an entry per heading of every page, ranking puts a title match first, and the empty state shows.

## Acceptance

- [ ] Searching "subscription", "effect" and "deploy" each lists the matching guide page first.
- [ ] The index and the search code load only when the command bar opens. Report their sizes.
- [ ] Focus is trapped in the open dialog and returns on close. Light and dark, 390 px wide.
- [ ] The `verify` command, `pnpm lint` and `pnpm format:check` pass.

## Notes for the worker

- Follow the ui-style skill.
