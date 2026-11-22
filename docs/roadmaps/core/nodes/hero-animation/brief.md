---
id: hero-animation
title: Build the chosen hero animation into the landing page
status: todo
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
spent:
owns:
  - website/src/landing/hero.ts
  - website/src/client/hero.ts
  - website/test/hero.test.ts
shared:
  - website/src/styles.css
  - website/src/landing/index.ts
  - website/test/landing.test.ts
  - website/src/demo/**
  - website/public/**
reserves: []
provides: []
depends_on:
  - on: landing-trim
    kind: hard
    why: replaces its hero picture
---

# Build the chosen hero animation into the landing page

User decision (2026-11-22): the hero uses sample 5, "the page wakes, the loop turns once" (`page-mvu.html`). Sources: `/private/tmp/claude-501/-Users-alexis-Documents-GitHub-idlip/66a8e5a8-2b9f-4b59-b751-902fd595146a/scratchpad/src/page-mvu.html` with shared parts inlined by `/private/tmp/claude-501/-Users-alexis-Documents-GitHub-idlip/66a8e5a8-2b9f-4b59-b751-902fd595146a/scratchpad/src/build.py`; built file and screenshots in `/private/tmp/claude-501/-Users-alexis-Documents-GitHub-idlip/66a8e5a8-2b9f-4b59-b751-902fd595146a/scratchpad/animations/` (`page-mvu-*.png`). The user was torn between sample 1 (MVU loop) and 4 (page wakes); 5 combines them.

## Do

- Replace the current hero picture (`landing/hero.ts`, `client/hero.ts`) with sample 5, rebuilt in the site's code: server-rendered markup from `landing/hero.ts`, a small client script, styles in `styles.css` using the site tokens (no duplicated token block, no separate theme toggle: the site's theme applies).
- Every name and number comes from the demo build (`DemoData`: loader size, handler and binding chunk names and sizes, the todos, the message `["toggle",["a2"]]`, the changed path), not typed in. Use the full chunk names where they fit; the short forms (`toggle.js`) only if the full ones cannot fit, and then keep the full name in `title`/aria.
- Keep the behaviors of the current hero that the review required: the auto-play never acts under the visitor's hand (cancel on focusin/pointerenter/pointerdown), one polite live line for what loaded, "cached"-style feedback on later clicks, reduced motion shows the end state with clicks working, no-JS shows a still end state, pauses off screen, no layout shift, 44 px touch targets, the caption that it is a model of the demo build.
- The scrubbable timeline: keyboard (arrows, Home, End), `role="slider"` with `aria-valuetext`.
- Keep the hero text and install tabs as they are.

## Acceptance

- Tests: phases with fake timers, cancel on interaction, reduced motion, numbers from DemoData, escaping.
- Playwright look at 1440 and 390 px, light and dark, reduced motion, no JS; described in outcome.md.
- Verify passes; `pnpm exec oxfmt --check website` clean.
