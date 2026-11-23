---
id: markup-vscode
title: VS Code extension and language server
status: dropped
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
spent: 160523
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

- [x] The language server returns diagnostics for a broken `.idlip` file and hover for a state variable, in a test.
- [x] The extension builds to a `.vsix`.
- [x] Fast check passes: `pnpm --filter @idlip/language-server test`

## Sizing

Two packages, mostly glue to Volar.

Landed as a666a6b on `feat/markup-frontend` after one clean fresh review. Follow-up: `markup-ts-plugin`.

Dropped 2026-11-21 by debate `debates/dsl`: built on `feat/markup-frontend` only, never merged; the branch stays as history.
