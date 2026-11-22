---
id: website-directions
title: Propose three visual directions for the website
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
size: S
spike: true
hypothesis:
verify:
exclusive: []
fulfilled_by:
gate: true
added: 2026-11-22
spent: 183000
owns:
  - website/directions/**
shared: []
reserves: []
provides: []
depends_on:
  - on: website-scaffold
    kind: hard
    why: the directions restyle the scaffold's landing and docs pages
---

# Propose three visual directions for the website

## Goal

The site copies the brumate website's look: the tokens in `website/src/styles.css`, Inter Tight, the warm orange accent and the cream background. `website/DESIGN.md` says "The tokens come from the brumate website." Propose three directions that are clearly idlip's own and clearly different from each other and from brumate. The user picks one, and `website-polish` builds it.

## Steps

- [ ] Read `website/DESIGN.md`, `website/src/styles.css` and `~/Documents/GitHub/brumate/website/DESIGN.md`, so no direction reuses brumate's palette, type pair or shapes.
- [ ] For each direction, write `website/directions/<name>/` with a `tokens.css` that overrides the `:root` tokens (light and dark), a static `landing.html` that mocks the richer landing page (hero, resume diagram, feature grid, benchmark numbers, live demo frame, todo sample), and a `docs.html` that shows one docs page.
- [ ] Take light and dark screenshots of each mock at 1440 px and 390 px wide, saved next to it.
- [ ] Write `website/directions/README.md`: per direction, one paragraph on the idea and how it ties to idlip's claim (the server renders, the browser resumes, a click loads only what changed), the type pair, the palette with contrast ratios, and the screenshot paths.

## Acceptance

- [ ] Three directions, each with tokens, two mocks and four screenshots.
- [ ] Every text color reaches 4.5:1 on its background in both themes. The README lists the ratios.
- [ ] No direction uses brumate's accent hues, Inter Tight, or its cream background.
- [ ] The scaffold's source is unchanged: this node only adds `website/directions/`.

## Notes for the worker

- Follow the ui-style skill. Avoid the look of generated design: no gradient blobs, no one-side borders on rounded parts, no emoji icons.
- Fonts must be free to self-host (OFL or similar). Name the source of each.
- Mocks are static HTML. They do not need to build with the site.
- `outcome.md` lists the three directions with their screenshot paths, so the orchestrator can show them to the user.
