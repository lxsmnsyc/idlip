---
id: markup-frontend
title: Markup DSL with control-flow blocks for views
status: todo
priority: should
type: feature
story:
early: false
outline: true
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

Replace the TSX view syntax with an own DSL that has real control-flow blocks (`#if`, `#for`, `#switch`), modeled on brumate's markup without its `<script>` and `<style>` blocks. The closed hole grammar becomes the language's own expression grammar. The DSL parses into the same view IR, so the compiler after the analysis does not change.

## Notes

- Decided in `debate/debate.md` (user overrule): TSX for the proof of concept, then the DSL.
- Open design: how the TS parts of a component (state, derived values, handlers, imports) sit beside the markup without script blocks. Since 2026-11-21 a component is a plain function, so the DSL may only need to replace the `return` JSX. Styles are an imported sidecar CSS file.
- The file stops being valid TS. Tooling follows brumate's route: a `toTypeScript()` emitter, Volar language-core, a `tsc` wrapper and an editor extension (`../brumate/packages/language-core`, `tsc`, `vscode`). oxlint and oxfmt will not read the files.
- Refine into a story with child nodes when `plan.py refine` lists it.
