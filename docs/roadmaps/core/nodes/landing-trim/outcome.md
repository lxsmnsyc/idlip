# Outcome: landing-trim

## For the user

The landing page has 51% fewer words, a hero that shows the product, and install tabs.

Hero headline: "Only the code you click loads." Support line: "idlip is a UI framework for server-rendered apps. No component code runs on load." Then the install tabs and "Read the guide".

The hero picture is the todo demo. At rest it shows "Component code loaded: 0 B" and the loader chip (3.9 kB). After a moment it clicks a checkbox by itself: the meter becomes 624 B, the two real chunks appear as chips (`todo.handler.toggle.js` 119 B, `todo.binding.todos._.done.js` 505 B), and only that row and the count change. The visitor can click any checkbox. Later clicks load nothing, and the chips show "cached" for a moment.

Course change during the work: the orchestrator asked to drop the growing-widgets hero and the "your app grows" headline. The scale message stays as the chart section ("JavaScript before the page is ready, by app size").

## Word count

`<main>` text outside code blocks, from `dist/client/index.html`:

| | Before | After | Change |
| --- | --- | --- | --- |
| All text in `<main>` | 2,478 | 1,218 | -50.8% |
| Visible at once (without the four static diagram panels) | 1,010 | 554 | -45.1% |

A test fails if the total goes above 1,485.

## What changed

1. Hero: headline, one support line, install tabs, guide button, and the picture. The conditions line left the hero. The loader range (3.9 to 7.3 kB), the 991 B inline listener, "before the load event" and the run conditions are in the chart foot. The chart lead is one sentence from the data. `writeHeadline` was removed.
2. Resume diagram: lane notes removed, each step sentence is one short line, lane subtitles are "Most frameworks" and "idlip", the model note is "Hydration is modeled, not measured." The stepper, both lanes, counters, network list and code panel stay.
3. Benefit cards: four instead of six, title and one line each, no code chips.
4. Sample: one caption ("Sizes are gzip."), chunk lines of a few words.
5. "Before you start": a four-item fact row (License, Version, Runtime, Language). The not-on-npm-before-0.1 fact stays.
6. Final call to action: heading, install tabs, guide button.
7. Install tabs: pnpm, npm, yarn, bun. `role="tablist"`, `aria-selected`, roving `tabindex`, arrow keys, Home and End. Both groups share the choice, saved in `localStorage` (`package-manager`). The copy button copies the active command and shows "Copied". The server writes pnpm active with the command as plain text. Without JS the tab row is hidden and the pnpm command stays.

## How the hero picture works

- Files: `src/landing/hero.ts` (markup, from `DemoData`), `src/client/hero.ts` (script), styles in `src/styles.css`, tests in `test/hero.test.ts`.
- Two phases, `rest` and `loaded`. CSS draws them from `--clicked` on the stage and `--done` on each row, with transform and opacity only.
- Rest to loaded: after 1.6 s on screen the script checks the flagged row. The first click, by the script or by the visitor, loads the chunks. The timer pauses while the picture is off screen (IntersectionObserver).
- Reduced motion: the script does not start the rest state or the timer. The picture stays at its end state (chunks loaded) and clicks still work, showing "cached".
- No JS: the server HTML is the end state, a still frame. The checkboxes are disabled until the script runs.
- No layout shift: the stage box is the same size in every state (checked at 1440 and 390 px).
- Without a flash: the end state is the CSS default. Only with the `js` class and motion allowed, CSS draws the rest state until the script sets `data-live`.

## Verify

- `pnpm --filter idlip build` and `pnpm --filter website build` pass.
- `pnpm --filter website test`: 77 tests in 7 files, pass. New: `hero.test.ts`, `install.test.ts`, and updated `landing.test.ts`.
- `pnpm --filter website check:samples`: 47 samples, 0 problems.
- `pnpm --filter website typecheck` passes.
- `pnpm lint` reports no error or warning in `website/` (warnings remain in `packages/idlip`, not touched).
- `pnpm exec oxfmt --check website` is clean.

## Screenshots

Playwright, Chromium, preview on port 48780 (stopped after).

- 1440 px, motion: hero is two columns. Left the headline with "click" in a chartreuse pill, the support line, the install tabs, the guide button. Right the ink-tone picture: the meter, a white card with two todo rows, and the chips. Rest frame shows 0 B, one row unchecked, a pointer near it. Frame after 3 s shows 624 B in chartreuse, both rows checked, two chartreuse chunk chips.
- 390 px: the same content in one column, the picture below the buttons, no horizontal overflow.
- Reduced motion and JS off: end state at once, same layout. Tab switch, copy text and arrow keys work in the browser run.
- Full page at 1440 and 390 px: sections in order, hero, diagram, four cards, chart, sample, facts row, final call to action.

## Not done or open

- The static diagram panels for reduced motion still repeat the stage four times, which is most of the 1,218 words.
- The package is not on npm before 0.1, so the install tabs name a command that fails until then. The facts row says so.
- The hero picture has two todos, because the demo has two. A third todo in the demo would show more of "later clicks load nothing".
