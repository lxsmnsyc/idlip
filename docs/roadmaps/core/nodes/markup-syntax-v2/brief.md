---
id: markup-syntax-v2
title: Markup DSL v2, the file is the component
status: dropped
priority: should
type: contract
story: markup-frontend
early: false
outline: false
milestone: apps
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter idlip exec vitest run test/compiler/markup
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - docs/proposals/0005-markup.md
  - packages/idlip/test/compiler/markup/fixtures/**
  - docs/roadmaps/core/nodes/markup-syntax-v2/**
shared: []
reserves: []
provides: []
depends_on:
  - on: markup-example
    kind: hard
    why: replaces the v1 grammar the story built
---

# Markup DSL v2: the file is the component

## Goal

The user rejected v1 (`markup-syntax`): a TS module whose component function returns JSX with `#` blocks is "sticking with TSX". In v2 an `.idlip` file is markup-first, like brumate's `.brm` files (`../brumate/docs/grammar.md`), without `<script>` and `<style>` blocks (the user's answer to Q1 in `debate/debate.md`):

- The file is the component. No wrapping function, no `return`, no JSX import, no `JSX.Element`.
- Top-level TS statements come first: imports, types, `let` (state), `const` (derived), function declarations (handlers). These follow `docs/proposals/0002-modules.md` unchanged.
- Markup follows, at the top level of the file, after the last statement. Markup anywhere else is an error.
- `props` is the component's input, typed by a top-level `type Props` or `interface Props`. With neither, the component takes no props. No compile-time markers or spec objects.
- Blocks stay as in v1: `#if/#else if/#else`, `#for (x, i of list by x.id)`, `#switch/#case/#default`, `#try/#catch (error, reset)`, `#head`. Lowercase built-ins `<subscribe>`, `<window>`, `<document>`.
- Child components are imported `.idlip` default exports, used by name in markup.

Decide the details the user did not: the boundary rule between the last statement and the first markup node (parse TS statements until a line starts with `<`, `#` or `{` at the top level, or a better rule from brumate), how generics on `Props` work, comments, and how the file is typed for tools (the virtual TS file `@idlip/language-core` builds). Write the frozen text of `contracts/markup-grammar.md` v2 in this node's folder (the orchestrator copies it), rewrite `docs/proposals/0005-markup.md`, and replace the fixtures: each `*.idlip.txt` with its expected lowered TS module (`*.tsx.txt`, the internal form the analyzer reads). Cover every feature on `batch/core`: nesting with message props, `<subscribe>`, `#try`, `#head`, refs, form fields, `html={trusted(...)}`, `<svg>`, async handlers.

## Acceptance

- [ ] Proposal 0005 and the grammar v2 text describe the file-is-the-component form, with a counter and the todo app as examples.
- [ ] One fixture per feature listed above; each expected lowered module passes `analyze()` with no errors.
- [ ] The outcome lists what changes for `markup-parser`, `markup-lower`, `markup-compile` and `markup-language-core`.

## Sizing

M: a spec and fixtures, no compiler changes.

Dropped 2026-11-21 by debate `debates/dsl`: TSX stays the one source syntax (option B).
