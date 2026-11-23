# Outcome: hero-animation

## Built

The landing hero picture is sample 5, "the page wakes, the loop turns once", rebuilt in the site's code. The hero text and the install tabs did not change.

- `website/src/landing/hero.ts`: `renderHeroStage(demo)` writes the markup of the still frame. It also exports `STORY_AT` (the moments on a 0 to 1 timeline), `STORY_CLASSES`, `STILL_AT` (0.74), `findClicked` and `shortenChunk`. The names, sizes, moments, slider texts and live lines go to the client in `data-story`.
- `website/src/client/hero.ts`: plays the story. Phases are one union: `auto`, `hands-on`, `replay`, `still`.
- `website/src/styles.css`: the hero picture block, with site tokens only. Below a stage width of 32rem a container query stacks the page.
- `website/src/demo/data.ts` and `build.ts`: `DemoData.helpers` (the shared helpers module, read from the `helpers` key of the chunk map in the state script) and `id` on each todo (the argument of its checkbox message).
- `website/test/hero.test.ts`: 22 tests in happy-dom. `happy-dom` `^21.0.4` is now a devDependency of `website`, as in `packages/idlip`.

### How it plays

1. Server render: a scan passes down the frame and the page blocks appear. The model chip appears, then turns into `<script i-state>`.
2. Page load: the `loader.js 4.0 kB` chip arrives in the browser bar. The timeline still says 0 B.
3. The pointer comes in and clicks the second todo. A ring marks the todo block, the other blocks dim, and the loop opens beside it.
4. Update: `toggle.js 119 B` and `_idlip-helpers.js 928 B` light, and the timeline says 1.0 kB. The step shows the message `["toggle",["a2"]]`.
5. Model: `todos[1].done` goes from `false` to `true`.
6. View: `todos._.done.js 233 B` lights and the timeline says 1.3 kB. The row and the count change, with a ring on each.
7. The story stops at the still frame (`STILL_AT`, 5.9 s), with the loop open. The slider can go on to 1, where the loop folds.

### Interaction

- The autoplay never clicks under the visitor's hand. A hand is a mouse or pen entering the browser frame, focus on a todo, or a press on a todo. Then the story plays up to the pointer's moment and waits. The pointer hides, and the second todo shows a pulsing ring and a "Click it" label.
- A touch that scrolls past the hero, and a pointer or focus on the timeline, do not count as a hand. The story plays on.
- The visitor's click on the second todo runs the loop from the press. The page takes no click before the loader, none on the first todo before the loop, and none while the loop runs.
- After the loop, a click on either todo flips it at once. A "cached" pill shows next to the value for 1.2 s and the row gets a ring. The polite live line says "Already loaded.".
- The live line says once, when the chunks are in: "Loaded todo.handler.toggle.js, 119 B, _idlip-helpers.js, 928 B and todo.binding.todos._.done.js, 233 B: 1.3 kB. One row and the count changed."
- The timeline knob is `role="slider"` with `aria-valuenow` (0 to 100) and `aria-valuetext` per step, such as "Model: todos[1].done turns true". Arrow keys move it by 2, Page Up and Page Down by 10, Home and End go to the ends. Dragging the knob or the track scrubs it. A key or a drag stops the story where it is. Only the knob has `touch-action: none`.
- Off screen (IntersectionObserver) or in a hidden tab, the frames stop and go on when back.
- Rows are 44 px tall and the knob is 44 by 44 px.

### Reduced motion and no JS

- Reduced motion: the script starts at the still frame, with the loop open, the row changed and 1.3 kB. It does not play. The first click on a todo says the first-load line. Later clicks show "cached". The slider works.
- No JS: the server HTML is the same still frame. The checkboxes and the knob are disabled.
- With JS and motion allowed, CSS hides the page and the timeline until the script sets `data-live`. If the script never runs, they show the still frame after 3.5 s.

### Numbers from `DemoData`

`loader`, `handler`, `helpers` and `binding` (names and gzip sizes) and their sums, the todos with their ids, `token` (the message, and the id that picks the clicked todo), `writes[0]` with the clicked index (`todos[1].done`), and the opening tag of `state`. The demo now measures `loader.js` at 4.0 kB and the binding chunk at 233 B. The hero shows those, not the 3.9 kB and 505 B in the sample.

## Deviations

- The step chips use short names (`toggle.js`, `todos._.done.js`), with the full name in `title`. The live line and slider texts use the full names.
- The Update step has a second line with the helpers chip. The sample has no helpers.
- The story stops at the still frame. Sample 5 loops every 8 seconds, which would undo the visitor's later clicks. The slider replays it.
- The Update step shows the message `["toggle",["a2"]]` from `DemoData.token`, not `toggle("a2")`.
- The timeline label is "Code loaded on click".
- Text in the picture is 12 px (`--text-xs`) at the smallest, where the sample used 9 and 10 px. The frame is 316 px tall instead of 280, and the stacked frame 496 px.
- The tick labels use the text font. At 12 px the mono labels touched.
- The moments moved a little (`load` 0.29, `click` 0.45) so the tick labels do not touch. Below 32rem the labels drop their first word ("render", "load").
- The breakpoint went up to 32rem, not down to 27rem as review asked. At 12 px the View step needs about 234 px for `View` and `todos._.done.js 233 B`. The strip is the stage width minus 240 px, so the side-by-side layout needs a stage of about 512 px. The two-column hero gives the picture 540 px at 1440 and under 512 px below about 1290 px of viewport, where it stacks.

## Stubs left

- None.

## Gotchas

- The CSS default of every per-frame property is its value at `STILL_AT`, except `--t`, which the server writes inline. Moving `STILL_AT` past `fold` (0.8) would need new CSS defaults for `--lift` and `--open`.
- `renderHeroStage` throws when no todo has the id the message names. The website build then fails, on purpose.
- The sample section under the hero ("What the todo demo loads") still lists the handler and the binding without the helpers. That section is outside this node.

## Proposed learnings

- A picture the server draws and a script animates keeps its per-frame values as custom properties whose CSS defaults are the still frame | no-JS and reduced motion then need no extra rules | `website/src/` | yes, a test can compare the server markup with the script at the still time

## Verification

- `pnpm --filter idlip build`: pass.
- `pnpm --filter website build`: 28 pages.
- `pnpm --filter website test`: 118 tests in 9 files, pass. `hero.test.ts` has 22, including one against `dist/demo-server/demo.json`.
- `pnpm --filter website check:samples`: 49 samples, 42 live, 0 problems.
- `pnpm --filter website typecheck`: pass.
- `pnpm lint`: no finding in `website/`. Warnings remain in `packages/idlip`, not touched.
- `pnpm exec oxfmt --check .`: clean.

## Screenshots

Playwright, Chromium, `vite preview` on port 48820, stopped after.

- 1440 px, light: two columns. The right column is a white browser frame on the ink tile and a dark timeline under it. At 5.6 s the loop is open with the three chips, `false` to `true`, both todos checked, and 1.3 kB. At 7 s it is the same frame: the story stopped at the still frame.
- Hover at 1440 px: the mouse over the frame, the story waits at t = 0.36. The second todo has the olive ring and a "Click it" pill to its left, and the timeline says 0 B.
- 1440 px, dark (site theme toggle): light ink tile, dark frame, light grey timeline, rings in chartreuse.
- Knob focus in dark: a dark ring around the knob on the light timeline.
- 1200 px: stage 473 px, stacked layout. 800 px: stage 664 px, side by side. No horizontal overflow at 1440, 1200, 800 or 390.
- 390 px, light and dark: stacked layout, the "Click it" pill inside the row on hover. Stage height 639 px.
- Reduced motion at 390 px and no JS at 1440 px: the still frame at once.
- Interaction run at 1440 px: a mouse over the timeline only, the story went on (t = 0.54 at 4.2 s). Over the frame it waited at 0.36 with the cue. A click ran the loop to 0.74 and the live line listed the three files and 1.3 kB. A later click showed "cached" and "Already loaded.". Home and two Page Up went to 0.20, and a drag to 60% of the track went to 0.60. Stage height stayed 458.6 px.

## Size

- Estimated M, actual M.
