---
id: landing-trim
title: Cut the landing page text, animate the hero, add install tabs
status: done
priority: should
type: feature
story:
early: false
outline: false
milestone: 0.1
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter idlip build && pnpm --filter website build && pnpm --filter website test && pnpm --filter website check:samples && pnpm lint
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-22
spent: 491000
owns:
  - website/src/landing/**
  - website/src/client/**
  - website/src/styles.css
  - website/src/layout.ts
  - website/public/**
  - website/test/landing.test.ts
  - website/test/chart.test.ts
  - website/test/hero*
shared:
  - website/src/demo/**
reserves: []
provides: []
depends_on:
  - on: plain-tsx
    kind: hard
    why: plain-tsx renames files the landing sample and demo reference
---

# Cut the landing page text, animate the hero, add install tabs

User feedback on the landing page after `website-landing` (2026-11-22):

1. "Too much noise. The hero itself is filled with so much text. The page is text-heavy and could use some reduction."
2. "The landing page could use some animation, especially on the hero section."
3. "The install code could use a tabs version, check my other websites."

Load the skills `agent-skills:landing-page`, `agent-skills:ui-style` and `agent-skills:plain-writing`.

## 1. Cut the text

- Measure the word count of `<main>` on the built landing page before and after (`website/dist/client/index.html`, text content only, code blocks excluded). Target: at least 40% fewer words. Record both numbers in outcome.md.
- Hero: the headline, at most one short support line (about 15 words), the install tabs and the primary action. The conditions line (loader range, listener, per-click loading) leaves the hero: the facts move to the chart section, where the numbers are shown, or into a footnote next to the chart.
- Every section: one heading, at most one short lead sentence. Let the visual carry the point (ui-style "Let the layout explain").
- Resume diagram: keep the stepper and the two lanes; shorten the per-step sentence and the lane notes to one short line each, or drop the lane notes where the counters and the network list already say it. The code panel stays.
- Benefit cards: title plus at most one short line each; consider fewer cards.
- "Before you start": a compact fact row (license, version, runtimes), not paragraphs.
- Sample and chunk list: no paragraph under it, one caption at most.
- Keep every number accurate and its conditions reachable (on the chart foot or the benchmarks page link), as `website-landing` required.

## 2. Animate the hero

- The animation shows what the product does (landing-page skill, Playful UI). Suggested: a picture of a page whose widgets grow in number (10, then 50, 200, 1,000) while a meter of "JavaScript before the page is ready" stays the same size; then a click on one widget brings in one small chunk (a chip with its name and size) and only that widget updates. The numbers come from `benchmarks.json` and the demo data, not typed in.
- Better if the visitor can interact: click a widget in the picture to load "its" chunk.
- Brumate's hero does a related idea (`/Users/alexis/Documents/GitHub/brumate/website/src/components/home/ResumeStage.brm`, `NetworkStrip.brm`). Use it for the idea only: the user asked earlier that the idlip site not reuse brumate's look. Stay in the Block identity (`website/DESIGN.md`).
- Rules: transform and opacity only; starts on first paint is allowed for the hero (landing-page skill lifts the rule for the product demo); pauses when off screen; `prefers-reduced-motion` shows the end state; no layout shift (reserve the box); works on mobile; no JS shows a still frame.

## 3. Install tabs

- Tabs for pnpm, npm, yarn and bun, with a copy button that copies the active command and shows "Copied". Reference: brumate's `website/src/components/home/Install.brm` and atemno's `InstallCommand` in `/Users/alexis/Documents/GitHub/atemno/website/src/pages/Home.tsx` (terracotta tabs). Follow the same behavior: `role="tablist"`, `aria-selected`, arrow keys move between tabs, the choice persists across the hero and the final call to action (and across visits via localStorage is a nice-to-have).
- Server-rendered with pnpm active; works as plain text without JS.

## Acceptance

- Word count of `<main>` down at least 40%, numbers in outcome.md.
- Hero animation as above, with a reduced-motion test and a no-JS still.
- Install tabs on the hero and the final call to action, tested (tab switch, copy text).
- Verify passes, `pnpm exec oxfmt --check website` clean. Screenshots at 1440 px and 390 px described in outcome.md (Playwright or Chrome headless in the worktree; do not touch port 48740).
