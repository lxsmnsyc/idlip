# Log: docs-animations

## 2026-11-22

- Built the samples with `build.py` into the scratchpad and looked at `mvu-loop.html` and `message-trace.html` in Playwright. Both are 560 by 440 px with a theme toggle, riders on SVG paths measured at run time, and fixed numbers (505 B, 624 B).
- Syntax: a ` ```figure <name> ` fence with no body. `src/figures/names.ts` holds the names and imports nothing, because `layout.ts` calls `createRenderer()` at load, and `markdown.ts` importing the figures (which import `layout.ts`) would be a cycle.
- `loadPages` takes the demo as a fifth argument. Without it a figure renders as an empty `<figure>`, so tests and `check:samples` that call `loadPages()` with no build still work.
- Player: one shared chunk, `src/figures/player.ts`, for both figures. A step list with `on-<id>` classes, as in the samples' `base.js`, not the hero's per-frame properties. No riders: the lit state moves from card to card instead, which needs no layout measuring and works at 390 px.
- First look: the trace stacked at 560 px because the message line did not fit half the figure. The message now goes on its own line, and the two columns start at 34rem.
- The MVU Update card overlapped the View card. Moved the View heading into the app card, the ring to `cy=44 ry=39`, Update to 44%/83% and the well to 304 px. At the 33rem breakpoint the cards are 2 px apart vertically.
- `.fig-swap > span` was `inline-flex` with a gap, which spaced `toggle ( "a2" )`. The gap is only on the size swap now.
- `.prose :not(pre) > code` gave the figure's code the inline code fill. Reset under `.prose .fig-well code`, so the caption keeps it.
- Lint: `prefer-default-export` disabled per file as in `landing/hero.ts`, `no-loop-func` fixed by moving the start function out of the observer loop as in `client/live.ts`.
- Happy-dom tests cannot import `site.ts` (`fileURLToPath` on a non-file URL), so the DemoData test renders the docs Markdown with `createRenderer` directly.

## 2026-11-22, review fixes

- Rebased onto `batch/core` at `6918353` (fix-string-length). The loader grew from 9953 B to 10001 B, and the click chunks from 1319 B to 1322 B gzip.
- A later click replays the loop with `is-cached` and `is-flipped` on the root. The player keeps one `Run` union (`first`, or `later` with `back`).
- `resuming.md` 505 B: written on 2026-11-21, when the helpers were copied into each chunk (`ef63cb1`). The shared helpers module came on 2026-11-22. The e2e tests check the request names, not sizes.
- A test that compared the resuming tables with `demo.json` failed right after the rebase. Removed it, so loader changes in other nodes do not fail the website tests. The tables are kept by hand.
- The figures have their own row, box, text, app head and count classes. No hero rule is shared.
