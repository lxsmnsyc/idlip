---
id: website
title: Publish the documentation website on Vercel
status: todo
priority: should
type: chore
story:
early: false
outline: false
milestone: 0.1
target:
ship: auto
land: auto
from:
size: S
spike: false
hypothesis:
verify: pnpm --filter website build && pnpm --filter website check:samples
exclusive: []
fulfilled_by:
gate: true
added:
spent:
owns:
  - website/vercel.json
shared: []
reserves: []
provides: []
depends_on:
  - on: website-scaffold
    kind: hard
    why: the site builds and checks its samples
  - on: docs-start
    kind: hard
    why: the guide must be complete before it goes public
  - on: docs-effects
    kind: hard
    why: the guide must be complete before it goes public
  - on: docs-nesting
    kind: hard
    why: the guide must be complete before it goes public
  - on: docs-platform
    kind: hard
    why: the guide must be complete before it goes public
  - on: docs-reference
    kind: hard
    why: the reference must be complete before it goes public
  - on: docs-benchmarks
    kind: hard
    why: the numbers must be on the site before it goes public
---

# Publish the documentation website on Vercel

## Goal

Add `website/vercel.json` and hand the deployment to the user. This node assembles the website: it waits for every page node. Deploying is outward-facing (a public site, a Vercel project, a domain), so a worker does not run it. The node is a gate: the user deploys, then closes it.

## Context

- Source: `~/Documents/GitHub/brumate/website/vercel.json`. Same shape: deploy only `main` (`git.deploymentEnabled`), an `ignoreCommand` that skips builds when `website`, `packages` or the lockfile did not change, `buildCommand` that builds the workspace dependencies then the site, `outputDirectory: dist/client`, `cleanUrls`, immutable cache headers on `/assets/`.
- Do not copy brumate's COOP and COEP headers unless the site has a playground that needs them.

## Steps

- [ ] Worker: write `website/vercel.json` and check that its `buildCommand` works from a clean checkout (`pnpm install --frozen-lockfile` then the command).
- [ ] Worker: write the exact steps below into `outcome.md` and stop.
- [ ] User: `vercel link` in `website/` (root directory `website`, framework preset Other), connect the GitHub repository, set the production branch to `main`, deploy, and attach a domain if wanted.
- [ ] User: open the deployment and confirm the sidebar, a code block, the benchmark table and a 404.

## Acceptance

- [ ] `website/vercel.json` exists and its build command passes locally.
- [ ] `pnpm --filter website build && pnpm --filter website check:samples` pass.
- [ ] The user confirms the Vercel deployment works (gate).

## Sizing

S: one config file. The deployment is a human step.

## Notes for the worker

- Do not run `vercel`, push, or trigger any workflow. Check `gh repo view --json visibility` before suggesting anything that runs CI; run checks locally.
- Write no tokens or project ids into the repo.

## Updates after wave 9

- `build.js` of the client build must be served with `Cache-Control: no-store` or a short max age (`deploy-skew`). The `immutable` header for `/assets/` in `vercel.json` must not match it: check where the build writes `build.js` (next to the loader entry) and give it its own header rule.

## After debate `debates/dsl` (2026-11-21)

TSX stays the one source syntax. Pages and examples use `*.idlip.tsx`; no markup DSL, no `@idlip/language-core` or `@idlip/tsc`.
