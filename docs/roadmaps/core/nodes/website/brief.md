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
  - website/public/og.png
  - website/docs/resuming.md
  - website/src/markdown.ts
  - website/src/repl/**
shared: []
reserves: []
provides: []
depends_on:
  - on: repl-origin
    kind: hard
    why: the public site must not run share-link code on its own origin
  - on: website-search
    kind: hard
    why: the public site needs its search
  - on: website-repl
    kind: hard
    why: the public site needs its repl
  - on: website-polish
    kind: hard
    why: the site goes public with its own identity and the full landing page
  - on: docs-live
    kind: hard
    why: samples run in place before the site goes public
  - on: hero-animation
    kind: hard
    why: the public site ships the chosen hero
  - on: docs-animations
    kind: hard
    why: the docs figures go public with the site
  - on: landing-trim
    kind: hard
    why: the trimmed landing page goes public
  - on: website-landing
    kind: hard
    why: the landing page sells the benefit before the site goes public
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

## Updates after release 0.1.0 (2026-11-24)

The user approved three fixes that ride with this node:

- **Share image.** `website/public/og.png` shows an old headline. Redraw it with the current hero headline, "Only the code you click loads." (read it from the landing source, do not retype it). Reuse whatever script or source made the current image if one exists; otherwise render it from an idlip-free HTML file with Playwright at 1200x630 and keep that source in `website/scripts/`. Show the result in the outcome.
- **Sizes in `resuming.md`.** Every byte count in the page (the listener, the two request tables) is typed by hand and drifts. Have the build fill them from measured values, the way the landing page reads `demo.*.gzip`. Keep the markdown readable: a placeholder the markdown renderer replaces, with a build error for an unknown name.
- **Fonts in the REPL frame.** The sandboxed frame (`sandbox="allow-scripts"`, opaque origin) loads `/fonts/*.woff2` cross-origin, so the fonts are blocked without CORS. Add `Access-Control-Allow-Origin: *` for `/fonts/(.*)` in `vercel.json`, and make `vite preview` and the dev server send the same header so the fix can be checked locally. Confirm in a browser (Playwright, not the user's Chrome) that the frame renders with the site fonts.
