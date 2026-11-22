---
id: website-landing
title: Make the landing page sell the benefit, from the final review
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
verify: pnpm --filter idlip build && pnpm --filter website build && pnpm --filter website test && pnpm --filter website check:samples
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-22
spent: 754000
owns:
  - website/src/landing/**
  - website/src/client/**
  - website/src/layout.ts
  - website/src/styles.css
  - website/src/site.ts
  - website/public/**
  - website/test/**
shared: []
reserves: []
provides: []
depends_on:
  - on: website-polish
    kind: hard
    why: edits the landing page it built
  - on: bench-scale
    kind: hard
    why: the hero and the chart read its numbers
---

# Make the landing page sell the benefit

A final review of the landing page against the ui-style and landing-page skills (load both) found the page explains the technique but does not sell the result, and is missing parts a library landing page needs. Fix these. Keep the Block identity, the resume diagram and the growth chart.

## Changes, in priority order

1. **Hero headline states the result.** The strongest fact is in section 4: idlip loads the same 4.7 kB of JavaScript before the page is ready at 10 or 1,000 widgets. Lead with that (for example "Pages ready on 4.7 kB of JavaScript, at any size."). Read the number from `benchmarks.json` through the same rule as `writeLead` (within 10% means "the same"), with a plain fallback headline. Move "Server renders, browser resumes" into the support line.
2. **Install command in the hero** with a copy button, beside the primary CTA. The package is `idlip` (peer: `vite >=7`). It is not on npm until the 0.1 release; show `pnpm add idlip` anyway, since the site deploys after the release (the orchestrator tracks this).
3. **A real demo right below the hero.** Link the sample and the hero to the REPL (`/repl/#example=todo` or `#example=counter`, see `website/src/repl/files.ts`). Keep it cheap: a link or a small "Try it in the REPL" action, no embedded REPL on the landing page.
4. **Benefit cards instead of a feature list.** Rewrite the feature grid so each card's title is what the visitor gains, with the feature behind it in the text. Drop table-stakes cards (the Vite plugin goes to a short list or the FAQ). Drop the arrow icon on every card title; the hover state of the whole card shows it is a link. Fix the truncated code chips (`<Subscribe to={timer} …`).
5. **Objections section** (short FAQ or fact list): MIT license, version and maturity (0.x, pre-release), Node >= 22 and Vite >= 7, TypeScript/TSX, browser support (check the docs for what is claimed; claim nothing that is not documented).
6. **Final CTA** at the end of the page repeating the primary action and the install command.
7. **The sample is the smallest working code.** Replace the 60-line todo source in a scroll box with a short example (the counter, or a trimmed todo) beside its output or with an "Open in REPL" link, plus the chunk list. The code must compile (`check:samples` or an equivalent test).
8. **Chart bars animate when they scroll into view**, not on first paint (IntersectionObserver adds a class; without JS or with reduced motion the bars show their end state). Keep the duration within 150 to 250 ms per bar, a stagger is fine.
9. **Chart sizes not by shade alone.** Label which bar is which size on the bars (for example the widget count before each value on the first row, or on every value).
10. **Copy buttons** reach a 44 px hit target on touch (`@media (pointer: coarse)`), visible size can stay.
11. **Number mismatch.** The sample lists `loader.js` at 3.9 kB while the chart says 4.7 kB loads before the page is ready (loader plus the inline listener). Make the two agree or say why in the chunk list.
12. **Open Graph tags** on the landing page: `og:title`, `og:description`, `og:type`, and `og:image` pointing at a static image in `website/public/` that shows the product (a still of the growth chart or the hero is fine; an SVG converted to PNG at build is fine, a hand-made PNG committed is fine). Add `twitter:card`.
13. **Shorten the diagram's footnote** under the resume diagram to one short sentence.

Leave the todo text "Build <the> runtime" in `examples/todo` alone (it tests escaping); if the diagram shows it, that is acceptable, or pick another row if the diagram code allows without touching the example.

## Acceptance

- All 13 items done, or a line in `outcome.md` saying why one was left.
- Copy follows plain-writing: no empty claims, every number has its conditions or a link.
- `website/test/landing.test.ts` covers the new section order, the hero number and fallback, the install command, the final CTA and the OG tags.
- Verify command passes; `pnpm format` clean.
