---
id: docs-reference
title: API reference and editor setup
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
  - website/docs/reference/**
  - website/docs/editor.md
shared: []
reserves: []
provides: []
depends_on:
  - on: website-scaffold
    kind: hard
    why: adds Markdown pages that the scaffold's build, sidebar and sample checker process
  - on: markup-frontend
    kind: hard
    why: documents the DSL grammar and the idlip/compiler markup exports
  - on: markup-ts-plugin
    kind: hard
    why: the editor page covers the VS Code extension, idlip-tsc and the TypeScript plugin
  - on: custom-effects
    kind: hard
    why: the reference lists the effect API
  - on: commands-subs
    kind: hard
    why: the reference lists the command and subscription API
  - on: dom-refs
    kind: hard
    why: the reference lists the ref API
  - on: nesting
    kind: hard
    why: the reference lists the nesting API
---

# API reference and editor setup

## Goal

A reference page per published subpath (`idlip`, `idlip/server`, `idlip/client`, `idlip/compiler`, `idlip/vite`, `idlip/jsx-runtime`, `idlip/testing`), a page for the DSL syntax (blocks, attributes, error ids), and `editor.md`: the VS Code extension, `idlip-tsc`, the TypeScript plugin and the `tsconfig` settings (`jsx: "preserve"`, `jsxImportSource: "idlip"`).

## Context

- Source: the public exports of `packages/idlip/src` and `package.json` `exports`; `docs/roadmaps/core/contracts/markup-grammar.md`; outcomes of `markup-language-core`, `markup-vscode` and `markup-ts-plugin` (on the story branch until it lands).
- Write each reference page from the exported names and their doc comments. Do not copy signatures by hand if a script can print them; a small script in `website/scripts/` is allowed only if it does not collide with the scaffold's files (put it under `website/scripts/reference/`).
- Pages for subpaths whose nodes are still open (`idlip/testing` is done; others as built) list what exists at write time.

## Acceptance

- [ ] One page per published subpath, and a syntax page and `editor.md`, with front matter.
- [ ] Every export of each subpath appears on its page (a test or script compares the page against the package's built `index.d.ts`).
- [ ] Every `idlip` sample compiles: `pnpm --filter website check:samples`.
- [ ] `pnpm --filter website build` passes.

## Sizing

M: about eight pages with an export-coverage check. Verifiability is a script.

## Notes for the worker

- Follow the plain-writing skill.
- The extension is private and not on the marketplace; say how to install the `.vsix` (see the `markup-vscode` outcome).
