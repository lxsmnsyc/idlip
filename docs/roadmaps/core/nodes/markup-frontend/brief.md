---
id: markup-frontend
title: Markup DSL with control-flow blocks for views
status: dropped
priority: should
type: story
story:
early: false
outline: false
milestone: apps
target:
ship: auto
land: auto
from:
size: XL
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-20
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: example-todo
    kind: hard
    why: the TSX proof of concept comes first, by the user's choice
---

# Markup DSL with control-flow blocks for views

## Goal

Replace the TSX view syntax with an own DSL that has real control-flow blocks (`#if`, `#for`, `#switch`), modeled on brumate's markup without its `<script>` and `<style>` blocks. A `.idlip` file is a plain TS module whose components are plain functions; the compiler lowers the markup to TSX and runs the existing analyzer unchanged, so everything after analysis stays as is.

## Context

- Decided in `debate/debate.md` (user overrule): TSX for the proof of concept, then the DSL.
- Tooling follows brumate: a `toTypeScript()` emitter, Volar language-core, a `tsc` wrapper and an editor extension (`../brumate/packages/language-core`, `tsc`, `vscode`). oxlint and oxfmt will not read the files.
- Styles stay an imported sidecar CSS file.
- Children: `markup-syntax`, `markup-parser`, `markup-lower`, `markup-compile`, `markup-language-core`, `markup-vscode`, `markup-example`.
- Open question for the user at the `markup-syntax` gate: GOAL.md says one published package, but the tooling needs `@idlip/language-core`, `@idlip/tsc` and a private VS Code extension.

## Acceptance

- [ ] The todo example written in the DSL passes the e2e tests with the same network request set.
- [ ] `pnpm typecheck` checks `.idlip` files and reports a hole type error at the `.idlip` line.
- [ ] VS Code shows diagnostics and hover for `.idlip` files.

## Sizing

XL: syntax design, three compiler stages, two tooling packages and an example; split into seven children.

Dropped 2026-11-21 by debate `debates/dsl`: TSX stays the one source syntax (option B).
