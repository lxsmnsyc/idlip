---
id: website-scaffold
title: Website scaffold
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
added: 2026-11-21
spent:
owns:
  - website/package.json
  - website/tsconfig.json
  - website/vite.config.ts
  - website/DESIGN.md
  - website/README.md
  - website/src/**
  - website/scripts/*.ts
  - website/test/**
  - website/docs/index.md
shared:
  - pnpm-workspace.yaml
reserves: []
provides: []
depends_on:
  - on: markup-frontend
    kind: hard
    why: the sample checker compiles every idlip block with toTypeScript from idlip/compiler
  - on: example-todo
    kind: hard
    why: the starter page shows the working todo example
---

# Website scaffold

## Goal

Create the `website/` package: a static docs site built from Markdown files in `website/docs/`, with a sidebar, a search-free landing page, light and dark themes, syntax highlighting for `idlip` and `ts` blocks, and a check that every `idlip` code block in the docs compiles. Page nodes only add Markdown files, so they never touch this node's files.

## Context

- Source: `~/Documents/GitHub/brumate/website` (`DESIGN.md`, `scripts/`, `plugins/markdown.ts`, `plugins/front-matter.ts`, `vercel.json`). Copy the structure and the design tokens, not the brumate runtime.
- Decision: the site is a static build (Vite, markdown-it, a syntax highlighter such as the `@twinkleplop` packages brumate uses). It does not run on idlip, so the docs do not wait for the runtime nodes. Live demos are out of scope.
- Decision: pages show the markup DSL (`.idlip` blocks) as the only view syntax, because 0.1 ships it as the final syntax (`release-0-1`). TSX appears only on the page about `*.idlip.tsx` files, if at all. The `markup-grammar` contract and `docs/proposals/0005-markup.md` describe the syntax.
- Each page has front matter: `title`, `order`, `section`. The sidebar is built from it, so there is no navigation registry to edit.
- Read the outcomes of `markup-frontend` (story) and `example-todo`.

## Steps

- [ ] `website/package.json` (private), `tsconfig.json`, `vite.config.ts`, a build script that renders `website/docs/**/*.md` to `dist/client`.
- [ ] Layout: header, sidebar by `section` and `order`, table of contents, previous and next links, dark mode.
- [ ] Highlighting for fenced `idlip` blocks (reuse the TextMate grammar in `packages/vscode/syntaxes` if the highlighter accepts it).
- [ ] `scripts/check-samples.ts`: extract every fenced `idlip` block, run `toTypeScript()` and fail on a diagnostic. A block marked `idlip no-check` is skipped. Blocks marked `idlip fragment` are wrapped in a component first.
- [ ] One placeholder page `website/docs/index.md` and a landing page that states the claim and links the guide.
- [ ] Test: the build produces a page per Markdown file, the sidebar order follows `order`, the sample checker fails on a broken block.
- [ ] `DESIGN.md` with the tokens, shortened from brumate's.

## Acceptance

- [ ] `pnpm --filter website build` writes `website/dist/client` with a page per Markdown file.
- [ ] `pnpm --filter website check:samples` passes, and a test proves it fails on a block with a tag mismatch.
- [ ] The root `build` and `test` scripts still pass; the website is part of the workspace without breaking `pnpm --filter idlip test`.
- [ ] `pnpm lint && pnpm format:check` pass.

## Sizing

M: new package of 6 to 10 files, a known pattern from brumate that is new to this repo. Everything else is low.

## Notes for the worker

- Do not write `vercel.json` here; `website` owns it and the user deploys.
- No generated output is committed (`dist`).
- Add `website` to the root scripts only if the root `build` needs it; keep `pnpm --filter idlip test` fast.
- Follow the ui-style skill for the layout and states (focus, hover, empty search, dark mode).
