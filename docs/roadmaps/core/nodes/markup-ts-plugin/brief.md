---
id: markup-ts-plugin
title: TypeScript server plugin for .idlip imports
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
size: S
spike: false
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns: []
shared: []
reserves: []
provides: []
depends_on:
  - on: markup-frontend
    kind: hard
    why: needs the language core and the VS Code extension on the main branch
---

# TypeScript server plugin for .idlip imports

## Goal

A `.ts` or `.tsx` file that imports `./x.idlip` is untyped in the editor, because the VS Code extension has no TypeScript server plugin. Add `@idlip/typescript-plugin` as brumate does with `@brumate/typescript-plugin`, and register it from the extension. Found in the `markup-vscode` review.
