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

## 2026-11-22, review fixes

- Rebased onto `batch/core` (`f1cb02d`).
- Text in the picture is 12 px at the smallest. At 12 px Martian Mono the side-by-side layout needs a 512 px stage, so the container query moved to 32rem. The tick labels use the text font, since mono labels touched.
- The knob focus ring is `--on-ink`. The rings over changed nodes and the woken block are `--accent-strong`.
- A hand is now a mouse or pen entering the frame, focus on a todo, or a press on a todo. The waiting story shows a pulsing ring and a "Click it" pill on the second todo. A touch that scrolls past, and anything on the timeline, is not a hand.
- The loader fetches the shared helpers with the first handler (the `helpers` key of the chunk map). `buildDemo` reads that key into `DemoData.helpers`. The key is unquoted in the state script, so the regex takes an optional quote. The Update step shows a helpers chip, and the value and the live line count it: 1.3 kB, not 352 B.
- `findClicked` picks the todo whose id the message names. `buildDemo` reads each row's id from its checkbox message.
- The autoplay stops at `STILL_AT`. Chip and value transitions have no delay. Page Up and Page Down move by 0.1. Only the knob has `touch-action: none`.
- With reduced motion the first click says the first-load line, and only later clicks say "cached".
- Added `happy-dom` to the `website` devDependencies. New tests: the real demo build, a drag on the track, a click during the loop, each kind of hand then a click, touch and timeline focus not freezing, a click after a scrub, Page Up and Down, and the clicked todo by id. The CSS regex test is gone.
