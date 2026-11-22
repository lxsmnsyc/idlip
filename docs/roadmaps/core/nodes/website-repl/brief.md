---
id: website-repl
title: Add a REPL to the website
status: done
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
size: L
spike: false
hypothesis:
verify: pnpm --filter website build && pnpm --filter website test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-22
spent: 1270000
owns:
  - website/src/repl/**
  - website/test/repl*
shared:
  - website/src/layout.ts
  - website/src/site.ts
  - website/src/styles.css
  - website/vite.config.ts
  - website/package.json
  - pnpm-lock.yaml
reserves: []
provides: []
depends_on:
  - on: website-polish
    kind: hard
    why: the REPL page uses the site's new identity and its header
---

# Add a REPL to the website

## Goal

A `/repl/` page where a reader edits `*.idlip.tsx` files, sees the compiled output and diagnostics, and runs the result in the page: server render, then resume, with the same network panel as the landing demo, so the reader sees what each click loads.

## Context

- Source: `~/Documents/GitHub/brumate/website/src/routes/repl.brm`, `src/repl/files.ts`, `src/repl/highlight.ts` and `src/live/run.ts`. Brumate compiles in the browser, turns the TypeScript into modules with `oxc-transform`, loads each from a blob URL, maps runtime imports to modules the site ships, and answers its server calls in the page. Copy that design, not the brumate runtime.
- idlip's compiler uses `oxc-parser`. In the browser it needs the wasm binding (`@oxc-parser/binding-wasm32-wasi`, as brumate does). First check that `idlip/compiler` has no Node-only imports on the compile path. If it does, split them out in this node and say so in `outcome.md`.
- Read the `website-polish` outcome for how the landing demo renders and resumes. Reuse its network panel.

## Steps

- [ ] A spike first: compile and run the counter example in the browser. If the compiler cannot run there, stop and report in `outcome.md` with the blocking import.
- [ ] Editor with TSX highlighting (the site's `@twinkleplop` highlighter on a textarea overlay, as brumate does, or a small editor if that fails), several files, and tabs for output (compiled modules, state script, HTML) and diagnostics.
- [ ] Examples: counter, todo, a form, a subscription, an effect, nesting.
- [ ] Share link: the files are encoded in the URL hash, so no server is needed.
- [ ] Compile errors show inline with their position. Runtime errors show in the output panel and never break the page.
- [ ] A link to the REPL in the header, and "Open in REPL" on each guide sample that `check:samples` compiles.
- [ ] Tests: each example compiles in the test environment, a share link round-trips, and a broken file shows a diagnostic.

## Acceptance

- [ ] Every example runs: render, resume, and a click patches the page and shows its requests in the panel.
- [ ] The REPL code loads only on `/repl/` and on "Open in REPL", never on docs pages. Report the size of its chunks.
- [ ] Keyboard-usable editor and tabs, focus rings, light and dark, 390 px wide.
- [ ] The `verify` command, `pnpm lint` and `pnpm format:check` pass.

## Notes for the worker

- Follow the ui-style skill.
- Edit the shared files only to add the route, the header link and the "Open in REPL" button.
