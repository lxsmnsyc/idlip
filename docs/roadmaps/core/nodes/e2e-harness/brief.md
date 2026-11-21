---
id: e2e-harness
title: Playwright harness that counts chunks loaded on resume
status: active
priority: must
type: feature
story:
early: false
outline: false
milestone: todo-resumes
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter e2e test
exclusive: []
fulfilled_by:
gate: false
added:
spent:
owns:
  - e2e/**
  - .github/workflows/check.yml
shared:
  - pnpm-lock.yaml
reserves: []
provides: []
depends_on:
  - on: compiled-format
    kind: contract
    via: compiled-format
  - on: ssr-render
    kind: behavior
    via: compiled-format
  - on: resume-loader
    kind: behavior
    via: compiled-format
  - on: patch-lists
    kind: behavior
    via: compiled-format
---

# Playwright harness that counts chunks loaded on resume

## Goal

An `e2e/` workspace package with Playwright tests for the todo app: the page works before any script runs, the first click loads exactly one update chunk plus the changed binding chunks, and the DOM after each action equals a fresh server render.

## Context

- Until `example-todo` lands, serve the hand-compiled todo fixture from `packages/idlip/test/fixtures/todo/` with a small static server.

## Acceptance

- [ ] Tests run against the fixture and pass once the runtime nodes land.
- [ ] The test target comes from the `E2E_TARGET` variable (`fixture` or `example`), so `example-todo` switches it in one line of `e2e/playwright.config.ts`.
- [ ] A test clicks before page scripts finish loading, and the click still applies.
- [ ] Chunk counting reads network requests, not runtime internals.
- [ ] The todo page runs under a strict CSP with a nonce, `strict-dynamic` and Trusted Types, as brumate's e2e does.
- [ ] Any console error or failed request fails the test.
- [ ] Before the first event, no update or binding chunk loads and the state script is not decoded.
- [ ] The loader's gzip size stays within the budget set in `contracts/compiled-format.md`.
- [ ] `check.yml` runs the e2e tests with Chromium.

## Notes for the worker

- Use `pnpm add -D @playwright/test@latest` in `e2e/`. Install browsers in CI with `playwright install --with-deps chromium`.
