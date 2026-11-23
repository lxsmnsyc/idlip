---
id: editor-diagnostics
title: Show compiler errors in the editor
status: todo
priority: should
type: feature
story:
early: false
outline: true
milestone: '0.2'
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-23
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on: []
---

# Show compiler errors in the editor

idlip's compile errors (`event-statement`, `document-element-misplaced`, `title-outside-head` and the rest) only show when Vite builds, not as the user types. A TypeScript language-service plugin (the dropped `markup-ts-plugin` was the DSL's version) can run the analysis and report them in any editor that uses tsserver.

To settle when refined: plugin packaging (`idlip/ts-plugin` in `tsconfig.json`), performance on large files, and parity with the build errors (one source of truth).
