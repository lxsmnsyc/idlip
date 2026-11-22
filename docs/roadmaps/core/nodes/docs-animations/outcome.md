# Outcome: docs-animations

## Built

Two hero samples are animated figures in the docs, rebuilt in the site's code and tokens. Commit `7529716` on `node/docs-animations`.

- **Syntax.** A ` ```figure <name> ` fence with no body. oxfmt writes it with one blank line inside, which counts as empty. An unknown name fails the build with `docs/<page>.md:<line>: unknown figure "<name>". Figures: mvu-loop, message-trace.`. A fence with a body fails with `a figure fence has no body.`.
- **`mvu-loop`** on `docs/components.md`, after the table of declaration forms and one new lead-in paragraph. Model (left), View (the todo app, right) and Update (bottom) sit on a dashed ring. A Server/Browser switch and the meter "Code loaded on click" sit above it.
- **`message-trace`** on `docs/resuming.md`, in "The first click", after the five numbered steps and before the requests table. Left column: the todo app, the checkbox markup from `DemoData.row` with the message marked, and the meter. Right column: the Update, Model and Binding cards, each with its chunk name and size.
- **Landing.** The "What the todo demo loads" list names `_idlip-helpers.js` (969 B, same click) from `DemoData.helpers`. The "more chunks" count leaves out the helpers, so it reads 8.

### Files

| File                                   | Change                                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `website/src/figures/names.ts`         | The names. Imports nothing, so `markdown.ts` can check a name without an import cycle through `layout.ts`.      |
| `website/src/figures/index.ts`         | `renderFigure(name, demo)` and `stripFigures(html)` for the search index.                                       |
| `website/src/figures/parts.ts`         | `readClick(demo)`, the todo app, chips, swaps, the meter, the frame with caption and replay button.             |
| `website/src/figures/mvu-loop.ts`      | The MVU loop figure.                                                                                            |
| `website/src/figures/message-trace.ts` | The trace figure.                                                                                               |
| `website/src/figures/player.ts`        | The player, a lazy chunk.                                                                                       |
| `website/src/client/figures.ts`        | Observes figures and imports the player.                                                                        |
| `website/test/figures.test.ts`         | 16 tests, happy-dom.                                                                                            |
| `website/src/markdown.ts` (shared)     | The figure fence and the `figure` renderer option.                                                              |
| `website/src/site.ts` (shared)         | `loadPages(..., demo)` passes the demo to figures. The search index gets pages with figures cut to the caption. |
| `website/src/styles.css` (shared)      | The `.fig` block. `.fig-flash` joins the hero flash rule.                                                       |
| `website/docs/components.md` (shared)  | Lead-in paragraph and the fence.                                                                                |
| `website/docs/resuming.md` (shared)    | The fence.                                                                                                      |
| `website/src/landing/index.ts`         | The helpers line. The brief's update asked for it.                                                              |
| `website/README.md`                    | A "Figures" section. Not in the brief's paths. Documents the fence next to the live fences.                     |

### What loads when

- **Build.** The figure markup is in the page HTML: 6.5 kB raw and 1.7 kB gzip on each of the two pages.
- **Page load.** `site.js` holds `client/figures.ts`, an IntersectionObserver over `[data-figure][data-story]`. Pages with no figure load nothing more. Checked on `/`: no player request.
- **400 px before a figure.** `assets/player-*.js` loads, 2.3 kB raw and 1.05 kB gzip, once for both figures. Checked on `/docs/resuming/`: no request at the top of the page, one request after the scroll.
- **Player start.** It enables the checkbox, shows the replay button, and snaps from the last step to the first with transitions off.
- **40% in view.** The story plays. Off screen or in a hidden tab it pauses with the time left of the current step, and goes on from there.

### Numbers from `DemoData`

`handler`, `helpers` and `binding` (names and gzip sizes), their sums for the meter (`0 B`, 1.1 kB, 1.3 kB in this build), `handlerName` and `token` (the call `toggle("a2")` and the clicked todo), `todos` (texts, done, ids), `writes[0]` (`todos.*.done`, and `todos[1].done` for the clicked index), the opening tag of `state` (`<script i-state>`), and `row` (the checkbox markup with `i-a="5 7"`). The build throws when the row has no checkbox with the message, or when the handler writes no path.

### Story steps

| Figure          | Steps (ms to the next)                                                                                  | Click lands | Undo goes to |
| --------------- | ------------------------------------------------------------------------------------------------------- | ----------- | ------------ |
| `mvu-loop`      | start 400, render 1000, seal 900, ship 1100, aim 700, press 200, update 900, model 900, view 800, patch | `press`     | `ship`       |
| `message-trace` | start 500, aim 700, press 200, send 1000, model 1000, binding 900, patch                                | `press`     | `start`      |

- **MVU.** Server: the page rows and model fields appear, and the top arc lights. Seal: `<script i-state>` appears under the page. Ship: the switch moves to Browser, the meter shows 0 B, Model and Update dim. The pointer presses the second box. Update wakes with `toggle("a2")`, `toggle.js 119 B` and `_idlip-helpers.js 969 B`, and the arc View to Update lights. Model wakes and `todos[1].done` turns `true`. View: `todos._.done.js 231 B` on the top arc, 1.3 kB. Patch: the row and `0 left` change with rings. The current card has a ring.
- **Trace.** Press: the message in the markup turns chartreuse. Send: the Update sizes lose their lock icon and turn chartreuse, and the call shows. Model: the `todos.*.done` chip lights and the value flips. Binding: its size loses the lock icon and turns chartreuse. Patch: `row a2` and `count` light and the row and count change.

### Behaviors

- **Plays in view, pauses off screen,** stops at the last step. It does not loop.
- **Replay** is an icon button with `aria-label` and `title` "Replay", hidden without JS and with reduced motion.
- **Checkbox.** The clicked todo is a real `<input type="checkbox">` in a `<label>`, with the todo's text as its name. Before the press, a click or Space plays the click from `press` and hides the autoplay pointer. While the click runs, input is ignored. After the patch, a click puts the row back (undo step) and the live line says "Build <the> runtime is not done again.". The other rows are not inputs.
- **Live line** (polite) at the patch: "Loaded todo.handler.toggle.js, 119 B, _idlip-helpers.js, 969 B and todo.binding.todos._.done.js, 231 B: 1.3 kB. One row and the count changed."
- **Reduced motion.** The player keeps the server's last step. The checkbox toggles between the undo step and the last step at once.
- **No JS.** The last step, with the checkbox disabled and checked.
- **Theme.** Site tokens only. The figures follow the site toggle.
- **Layout.** At most 35rem (560 px). The MVU ring needs a 33rem container, and below that the cards stack (View, Update, Model, binding chip). The trace has two columns from 34rem and one below.

## Deviations

- **No riders.** The samples move chips and dots along SVG paths measured at run time. Here the chartreuse state moves from card to card, the MVU arcs light by opacity, and the current card has a ring. Nothing needs measuring, and the 390 px layout works the same way.
- **No panel slide.** The MVU sample slides from a server panel to a browser panel. Here the switch moves, and Model and Update dim until the click reaches them.
- **Undo instead of loop.** After the patch, a click on the row goes back to the undo step and waits. It does not replay by itself, as the samples did after 2.6 s. The meter goes back to 0 B. The real app would load nothing on a second click. The hero shows "cached" for that. The figures keep one story per click.
- **The story does not loop.** It stops at the last step, like the hero.
- **The View card heading** replaces the "Todos" title in the MVU figure. The trace keeps "Todos".
- **Sizes** come from this build: 231 B binding, 969 B helpers, 1.3 kB. The samples typed 505 B and 624 B.

## Stubs left

- None.

## Gotchas

- **Two sizes on one page.** `resuming.md`'s tables take their sizes from the e2e tests (binding 505 B, click 624 B, no helpers). The figure above them shows this build's 231 B, 969 B and 1.3 kB. Someone who owns `resuming.md` should update the tables or say where each number comes from.
- **The hero's classes.** The figures reuse `.hero-row`, `.hero-box`, `.hero-text`, `.hero-app-head`, `.hero-app-title` and `.hero-count`, and set `--done` from `--was`/`--now` on the clicked row by step. A change to those hero rules changes the figures.
- **New step names.** A `fig-swap at-<step>` only works for steps in the `:is(...)` list in `styles.css`: update, model, send, binding, patch. A new step name needs to be added there.
- **Fixed positions.** The MVU card positions are percentages tied to the ring (`cx 50 cy 44 rx 30 ry 39`). The margins are small at the 33rem breakpoint: Update and View are 2 px apart vertically.
- **No demo.** `loadPages()` with no demo renders `<figure class="fig" data-figure="<name>"></figure>`. Only `writeSite` passes the demo.

## Proposed learnings

- A docs figure that reuses a picture's markup works best as a step list with `on-<step>` classes, with the server writing the last step | no-JS, reduced motion and the lazy player then need no extra rules | `website/src/figures/` | yes, the tests check every class is on in the static HTML

## Verification

- `pnpm --filter idlip build`: pass.
- `pnpm --filter website build`: 28 pages.
- `pnpm --filter website test`: 134 tests in 10 files pass. `figures.test.ts` has 16: fence parsing and errors, static HTML of both figures, numbers against `dist/demo-server/demo.json` on the two docs pages, `stripFigures`, and the player (wait until 40% in view, play, pause off screen, click, ignore while running, undo, replay, reduced motion).
- `pnpm --filter website check:samples`: 49 samples, 42 live, 0 problems.
- `pnpm --filter website typecheck`: pass.
- `rtk proxy pnpm lint`: no finding in `website/`. Warnings remain in `packages/idlip`, which this node did not touch.
- `pnpm exec oxfmt --check .`: clean.

## Screenshots

Playwright, Chromium, `vite preview` on port 48840 (and a static server on 48841 for the samples). Both stopped after.

- **1440 px, light, `/docs/components/`.** The prose column is 704 px and the figure 560 px. Frames every 0.9 s: server with the top arc lit, seal with the capsule, browser at 0 B with Model and Update dimmed, the pointer on the second box, Update ringed at 1.1 kB, Model ringed with `true`, end at 1.3 kB with three arcs lit and rings on the row and count.
- **1440 px, light, `/docs/resuming/`.** The start (lock sizes, "waits for a message", `false`, 0 B, pointer on the box), Binding ringed at 1.3 kB, and the end with `row a2` and `count` lit.
- **Dark (site toggle) at 1440 px.** Both figures: dark cards on the dark well, chartreuse arcs and rings.
- **390 px, light and dark.** MVU stacked: switch, meter, View, capsule, Update, Model, binding chip. Trace in one column. `scrollWidth` is 390 on both pages.
- **Reduced motion.** The end state at once with no replay button. A click went to `ship` and back to `patch`.
- **No JS.** The end state on both pages, with the checkbox disabled.
- **Keyboard.** Space on the focused checkbox undid the change (`start`) with the olive focus ring on the row. Space again played from `press`. Space during the run was ignored. The run ended at `patch`, and Replay went back to `start`.
- **Landing.** The chunk list at 1440 and 390 px has the helpers line.

## Size

- Estimated M, actual M.
