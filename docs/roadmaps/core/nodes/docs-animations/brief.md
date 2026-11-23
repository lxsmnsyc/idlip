---
id: docs-animations
title: Reuse two hero samples as animated figures in the docs
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
spent: 377000
owns:
  - website/src/figures/**
  - website/src/client/figures.ts
  - website/test/figures*
shared:
  - website/src/markdown.ts
  - website/src/site.ts
  - website/src/styles.css
  - website/docs/index.md
  - website/docs/components.md
  - website/docs/resuming.md
  - website/docs/views.md
reserves: []
provides: []
depends_on:
  - on: hero-animation
    kind: hard
    why: shares the animation styles and client code it settles
---

# Reuse two hero samples as animated figures in the docs

User decision (2026-11-22): reuse the hero samples that fit the docs. Sources in `website/directions/hero-samples/` (`mvu-loop.html`, `message-trace.html`, shared parts in `build.py`), build them with `build.py` there.

Picked by the orchestrator:

- **The MVU loop** (`mvu-loop.html`): Model, View and Update as cards on a ring; the server turns the loop once and seals the model into `<script i-state>`; the click lights only Update → Model → one View slot. Place it where the docs introduce the model, view and update (`components.md` near the top, or the docs index), as the "how a component runs" figure.
- **Message trace** (`message-trace.html`): the checkbox's `on:click='["toggle",["a2"]]'` message travels to the handler, the model diff names `todos.*.done`, and the binding repaints the row and the count, each card labelled with its chunk. Place it in `resuming.md` where the message format and the handler/binding chunks are explained (or `views.md` "Events" if it fits better).
- Not reused: freeze-and-thaw (repeats the resume story the steps diagram and the hero already tell) and page-wake (superseded by the hero).

## Do

- A figure syntax in the docs Markdown (for example a fence ` ```figure mvu-loop ` or a directive) that renders the figure's server markup at build time and loads its small client script only when it scrolls near the viewport.
- Rebuild both in the site's code and tokens (site theme, no own toggle), numbers and names from the demo build (`DemoData`), not typed in. Keep them compact for a docs column (about 560 px wide, shorter if possible).
- Behaviors: plays when in view, pauses off screen, replay button, reduced motion shows the end state, no JS shows a still end state, keyboard access to the clickable checkbox, a `<figcaption>` of one sentence.

## Acceptance

- Two figures render on their pages; the build fails if a figure name is unknown.
- Tests: markdown parsing, static HTML, numbers from DemoData.
- Playwright look in light and dark, reduced motion, 390 px; described in outcome.md.

## Updates 2026-11-22

- `hero-animation` landed: read its outcome for the shared styles and client patterns (story driven by `data-story`, per-frame custom properties, `on-<moment>` classes, hands-on cue, slider). `DemoData.helpers` now exists (the shared helpers module, 928 B, loaded on the first click): figures that count click bytes include it.
- Also fix, in `website/src/landing/index.ts`, the "What the todo demo loads" chunk list in the sample section: add the helpers module (from `DemoData.helpers`).
