---
id: component-styles
title: Styles scoped to a component
status: todo
priority: could
type: feature
story:
early: false
outline: true
milestone: 
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

# Styles scoped to a component

Styling is plain CSS through Vite; nothing is scoped to a component. CSS Modules work today. Brumate compiles `<style>` blocks (`styles.md`, `style-compilation.md`). To settle when refined: whether idlip needs its own scoping beyond CSS Modules, and how styles load with the chunks that need them.
