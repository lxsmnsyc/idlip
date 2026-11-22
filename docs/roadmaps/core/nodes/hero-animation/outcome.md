# Outcome: hero-animation

## Built

The landing hero picture is sample 5, "the page wakes, the loop turns once", rebuilt in the site's code. The hero text and the install tabs did not change.

- `website/src/landing/hero.ts`: `renderHeroStage(demo)` writes the markup of the still frame, `STORY_AT` (the moments on a 0 to 1 timeline), `STORY_CLASSES`, `STILL_AT` (0.74) and `shortenChunk`. The names, sizes, moments, slider texts and live lines go to the client in `data-story`.
- `website/src/client/hero.ts`: plays the story. Phases are one union: `auto`, `hands-on`, `replay`, `still`.
- `website/src/styles.css`: the hero picture block, with site tokens only. Below a stage width of 30rem a container query stacks the page.
- `website/test/hero.test.ts`: 17 tests in happy-dom.

### How it plays

1. Server render: a scan passes down the frame and the page blocks appear. The model chip appears, then turns into `<script i-state>`.
2. Page load: the `loader.js 4.0 kB` chip arrives in the browser bar. The timeline still says 0 B.
3. The pointer comes in and clicks the second todo. A ring wakes the todo block, the other blocks dim, and the loop opens beside it.
4. Update: `toggle.js 119 B` lights and the timeline says 119 B. The step shows the message `["toggle",["a2"]]`.
5. Model: `todos[1].done` goes from `false` to `true`.
6. View: `todos._.done.js 233 B` lights and the timeline says 352 B. The row and the count change, with a ring on each.
7. The loop folds and the story stops at the end, after 8 seconds.

### Interaction

- The autoplay never clicks under the visitor's hand. On `focusin`, `pointerenter` or `pointerdown` before the click, it plays up to the pointer's moment and waits, with the pointer hidden.
- The visitor's click on the second todo runs the loop from the press. Before the loader arrives the page takes no click. Before the loop has run, the first todo takes no click.
- After the loop, a click on either todo flips it at once. A "cached" pill shows next to the value for 1.2 s and the row gets a ring. The polite live line says "Already loaded.".
- The live line says once, when both chunks are in: "Loaded todo.handler.toggle.js, 119 B, and todo.binding.todos._.done.js, 233 B. One row and the count changed."
- The timeline knob is `role="slider"` with `aria-valuenow` (0 to 100) and `aria-valuetext` per step, such as "Model: todos[1].done turns true". Arrow keys move it by 2, Home and End go to the ends. Dragging the knob or the track scrubs it. A key or a drag stops the story where it is.
- Off screen (IntersectionObserver) or in a hidden tab, the frames stop and go on when back.
- Rows are 44 px tall and the knob is 44 by 44 px (measured).

### Reduced motion and no JS

- Reduced motion: the script starts at the still frame (0.74), with the loop open, the row changed and 352 B. It does not play. Clicks on either todo work and show "cached". The slider works.
- No JS: the server HTML is the same still frame. The checkboxes and the knob are disabled.
- With JS and motion allowed, CSS hides the page and the timeline until the script sets `data-live`. If the script never runs, they show the still frame after 3.5 s (checked with scripts blocked).

### Numbers from `DemoData`

`loader.name` and `loader.gzip`, `handler.name` and `handler.gzip`, `binding.name` and `binding.gzip`, their sum, the todos, `token` (the message and the row id `a2`), `writes[0]` with the clicked index (`todos[1].done`), and the opening tag of `state`. The demo now measures `loader.js` 4.0 kB and the binding chunk 233 B, so the hero shows those, not the 3.9 kB and 505 B in the sample.

## Deviations

- The step chips use the short names (`toggle.js`, `todos._.done.js`), with the full name in `title`. The full names do not fit at 9px. The live line and slider texts use the full names.
- The story plays once and stops. Sample 5 loops every 8 seconds. A loop would undo the visitor's later clicks. The slider replays it.
- The Update step shows the message `["toggle",["a2"]]` from `DemoData.token`, not `toggle("a2")`.
- The timeline label is "Component code loaded", as in the old hero, not "component JS run".
- Rows are 44 px, not 40 px, for the touch target, so the frame is 288 px tall instead of 280.
- The moments moved a little (`render` 0.02, `load` 0.3) so the tick labels do not touch. Below 30rem the labels drop their first word ("render", "load").

## Stubs left

- None.

## Gotchas

- `website/test/hero.test.ts` runs in happy-dom. `happy-dom` is not in `website/package.json`. It resolves because the vitest install in the lock file has it as a peer. Add `happy-dom` to the website's devDependencies to make that explicit (the brief does not own `website/package.json`).
- The CSS default of every per-frame property is its value at `STILL_AT`, except `--t`, which the server writes inline. Changing `STILL_AT` past `fold` (0.8) would need new CSS defaults for `--lift` and `--open`.
- The 30rem breakpoint is a container query on `.hero-stage`, so between 1121 and about 1215 px of viewport the two-column hero shows the stacked layout.

## Proposed learnings

- A picture the server draws and a script animates keeps its per-frame values as custom properties whose CSS defaults are the still frame | no-JS and reduced motion then need no extra rules | `website/src/` | yes, a test can compare the server markup with the script at the still time

## Verification

- `pnpm --filter idlip build`: pass.
- `pnpm --filter website build`: 28 pages.
- `pnpm --filter website test`: 113 tests in 9 files, pass (`hero.test.ts` has 17).
- `pnpm --filter website check:samples`: 49 samples, 42 live, 0 problems.
- `pnpm --filter website typecheck`: pass.
- `pnpm lint`: no finding in `website/`. Warnings remain in `packages/idlip`, not touched.
- `pnpm exec oxfmt --check website`: clean.

## Screenshots

Playwright, Chromium, `vite preview` on port 48820, stopped after.

- 1440 px, light: the hero is two columns. The right column is a white browser frame on the ink tile and a dark timeline under it. Frames at 0.1 s (empty page, the scan wash at the top, timeline at 0 B), 3.3 s (page drawn, loader chip, pointer on the second todo), 4.8 s (loop open: Update lit, Model `false` to `true`, 119 B), 5.3 s (View lit, both todos checked, rings on the row and the count, 352 B) and 9 s (loop folded, playhead at the end).
- 1440 px, dark (site theme toggle): the ink tile is light, the frame is dark, the timeline light grey, as in the sample.
- 1200 px: the stage is 473 px wide and uses the stacked layout.
- 800 px: one column, wide layout, no horizontal overflow (`scrollWidth` 800).
- 390 px, light and dark: stacked layout, todo app on top, the loop under it, labels "render", "load", "click". No horizontal overflow. Stage height 595 px in every frame.
- Reduced motion, 390 px and 1440 px: the still frame at once. A click on the first todo unchecks it, shows "cached" and "1 left".
- No JS, 1440 px: the same still frame, install tabs hidden.
- Scripts blocked: empty frame at 0.5 s, still frame at 4 s.
- Interaction run at 1440 px: mouse over the stage at 0.4 s, the story waited at t = 0.36 with the pointer hidden. Clicking the todo ran the loop to 0.75 and the live line said "Loaded ...". A later click showed "cached" and "Already loaded.". Home went to 0, 20 right arrows to 0.40, a drag to 60% of the track to 0.60. Stage height stayed 430.6 px.

## Size

- Estimated M, actual M.
