# Log: hero-animation

## 2026-11-22

- Read the brief, `nodes/landing-trim/outcome.md`, the hero samples and `website/DESIGN.md`. Built the samples with `build.py` into `dist/client/samples/` to look at sample 5 next to the current hero.
- The demo build now measures `loader.js` at 4.0 kB and `todo.binding.todos._.done.js` at 233 B, not the 3.9 kB and 505 B of the sample. The hero reads them from `DemoData`, so it shows the new numbers.
- The sample is a fixed 560 by 440 board with absolute positions. The hero column is 436 to 540 px wide at two columns and up to about 700 px at one column, so the frame uses positions anchored to its left and right edges and widths from `calc(100% - 240px)`. Below a stage width of 30rem a container query stacks the page: the todo app on top, the loop under it.
- The sample drew the timeline as an SVG from measured pixels. The hero draws it with HTML: ticks, labels, the base line and the area take `left: calc(var(--at) * 100%)`, so the server can write it and it needs no script. The playhead and the knob sit in a wrapper as wide as the track, moved by `translateX(calc(var(--t) * 100%))`.
- Every per-frame value is a custom property on the stage (`--t`, `--pass`, `--dim`, `--lift`, `--open`, `--come`, `--pointer`, `--scan`). The CSS defaults are the values at the still frame (`STILL_AT` = 0.74), so no-JS and reduced motion need no extra rules. Block reveal by the scan is `clamp(0, (var(--pass) * var(--ph) - var(--y)) * 8 / var(--ph), 1)` with `--y` per block.
- The full chunk names do not fit the step chips: at 9px Martian Mono `todo.binding.todos._.done.js 233 B` is about 230 px and the chip has about 185 px. The chips show `toggle.js` and `todos._.done.js` (module and kind stripped by `shortenChunk`) with the full name in `title`. The live line and the slider text use the full names.
- The Update step shows the message from `DemoData.token` (`["toggle",["a2"]]`) instead of the sample's `toggle("a2")`, since that is the value on the checkbox.
- Sample 5 loops every 8 seconds. The hero plays once and stops at the end, because a later click by the visitor changes the rows and a loop would undo it. The slider replays it.
- Tests use `// @vitest-environment happy-dom`. `happy-dom` is not a dependency of `website`; it resolves through the vitest install, which has it as a peer from other packages. Noted in the outcome.
- Playwright found horizontal overflow at 800 px: the playhead wrapper moves past the track. `.hero-timeline` now has `overflow: hidden`.
- Checks pass: website build, 113 tests, 49 samples with 0 problems, typecheck, no lint findings in `website/`, oxfmt clean.
