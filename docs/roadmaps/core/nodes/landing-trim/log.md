# Log: landing-trim

- Baseline measured on the built `index.html`: `<main>` text outside `<pre>` is 2,478 words. 1,010 of them are visible at once; the rest is the four static diagram panels that show under reduced motion.
- Mid-task course change from the orchestrator: no growing-widgets hero. The hero shows the todo demo with "Component code loaded" at 0 B, one click that loads the handler and binding chunk, and later clicks that show "cached". The scale message stays as the chart section.
- Headline changed from "Your app grows. Its startup JavaScript doesn't." to "Only the code you click loads." `writeHeadline` and its conditions line are gone. The chart lead is one data-driven sentence, and the loader range, listener size and run conditions moved to the chart foot.
- Resume diagram: lane notes removed, step sentences cut to one short line, lane subtitles and station text cut.
- Benefit cards: six to four, code chips removed. Sample caption is "Sizes are gzip." "Before you start" is a four-item fact row.
- Install tabs (pnpm, npm, yarn, bun) on the hero and the final call to action. `src/client/install.ts` syncs both groups, saves the choice in `localStorage` (`package-manager`), and moves with arrow keys, Home and End.
- Hero picture state: `--clicked` on the stage and `--done` on each row. The server writes the end state. Under `prefers-reduced-motion: no-preference` and the `js` class, CSS draws the rest state until the script sets `data-live`, so there is no flash. The picture pauses its rest timer while off screen.
- Checked with Playwright at 1440 and 390 px, with motion, with reduced motion and with JS off. The stage box does not change size between states. No horizontal overflow. No console errors. Preview ran on port 48780 and was stopped.
