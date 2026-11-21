---
id: markup-vscode
title: VS Code extension and language server
status: active
priority: should
type: feature
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
verify: pnpm --filter @idlip/language-server test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - packages/vscode/**
  - packages/language-server/**
shared:
  - pnpm-lock.yaml
  - pnpm-workspace.yaml
reserves: []
provides: []
depends_on:
  - on: markup-language-core
    kind: hard
    why: uses the real language plugin
---

# VS Code extension and language server

## Goal

Create `packages/vscode` (private extension) and `packages/language-server` that show diagnostics and hover for `.idlip` files, built on `markup-language-core`.

## Context

- Follow brumate: `../brumate/packages/vscode`. The extension is private and is not published to npm.

## Acceptance

- [ ] The language server returns diagnostics for a broken `.idlip` file and hover for a state variable, in a test.
- [ ] The extension builds to a `.vsix`.
- [ ] Fast check passes: `pnpm --filter @idlip/language-server test`

## Sizing

Two packages, mostly glue to Volar.
