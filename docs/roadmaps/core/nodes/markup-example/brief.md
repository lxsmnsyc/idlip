---
id: markup-example
title: Todo example in the DSL
status: done
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
size: S
spike: false
hypothesis:
verify: pnpm --filter e2e test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent: 65069
owns:
  - examples/todo-idlip/**
shared:
  - pnpm-lock.yaml
reserves: []
provides: []
depends_on:
  - on: markup-compile
    kind: hard
    why: needs real compilation of .idlip
  - on: markup-language-core
    kind: hard
    why: typecheck must cover the files
---

# Todo example in the DSL

## Goal

Rewrite the todo example in `.idlip` and run the existing e2e tests against it.

## Context

- Keep the TSX example's behavior and network request set.

## Acceptance

- [x] The e2e tests pass with the same network request set as the TSX example.
- [x] `pnpm typecheck` checks the `.idlip` files.
- [x] Fast check passes: `pnpm --filter e2e test`

## Sizing

A port of an existing example.

Landed as 6198c80 on `feat/markup-frontend`. The orchestrator ran the full check and both e2e targets after the rebase. Accepted change outside owned paths: `e2e/playwright.config.ts` (a `todo-idlip` target). Gap: type-aware oxlint does not read `.idlip` files.
