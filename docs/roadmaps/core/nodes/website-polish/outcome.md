# Outcome: website-polish

## For the user

The site now uses the Block look across the landing page and the docs. The landing page has these sections in order: the hero, the resume diagram, a live demo, the feature grid, the benchmarks and the todo sample.

- **Resume diagram.** Two lanes run the same todo app, one with hydration and one with resumption. You move through four steps (Render, Load, Click, Patch) with the step buttons, the arrow keys, or by scrolling on a wide and tall screen. You can go back at any point. Each lane shows server, network and browser, plus two counters: component JS loaded and component code runs. In the browser view, blocks that ran code turn ink and blocks a binding patched turn chartreuse. In the resumption lane the other blocks fade to an outline. Beside the step text, the real server HTML of the second todo lights the part each step reads.
- **Live demo.** The demo runs idlip for real. The site build compiles `examples/todo` with `idlip/vite` and renders its page with the example's own `render()`. Its chunks ship under `dist/client/demo/`. The landing page shows it in a frame, beside a panel that lists every request the frame makes, taken from Resource Timing. In Chromium against `vite preview`, the page loads only the document, the loader and one font file, with 0 B of component code. One checkbox click loads `todo.handler.toggle.<hash>.js` and `todo.binding.todos._.done.<hash>.js`, 1.1 kB raw in total, and nothing else.
- **Benchmarks** come from `website/src/benchmarks.json`, with the run date and machine. The table shows 3 rows ahead, 1 even and 6 behind.

Screenshots of the landing page (taken after one click in the demo) and of `docs/resuming/`:

- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-ac734798a9595ab0b/docs/roadmaps/core/nodes/website-polish/landing-light-1440.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-ac734798a9595ab0b/docs/roadmaps/core/nodes/website-polish/landing-dark-1440.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-ac734798a9595ab0b/docs/roadmaps/core/nodes/website-polish/landing-light-390.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-ac734798a9595ab0b/docs/roadmaps/core/nodes/website-polish/landing-dark-390.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-ac734798a9595ab0b/docs/roadmaps/core/nodes/website-polish/docs-light-1440.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-ac734798a9595ab0b/docs/roadmaps/core/nodes/website-polish/docs-dark-1440.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-ac734798a9595ab0b/docs/roadmaps/core/nodes/website-polish/docs-light-390.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-ac734798a9595ab0b/docs/roadmaps/core/nodes/website-polish/docs-dark-390.png`

Resume diagram, one screenshot per step (light 1440, dark 1440, light 390):

- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-ac734798a9595ab0b/docs/roadmaps/core/nodes/website-polish/step-1-light-1440.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-ac734798a9595ab0b/docs/roadmaps/core/nodes/website-polish/step-2-light-1440.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-ac734798a9595ab0b/docs/roadmaps/core/nodes/website-polish/step-3-light-1440.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-ac734798a9595ab0b/docs/roadmaps/core/nodes/website-polish/step-4-light-1440.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-ac734798a9595ab0b/docs/roadmaps/core/nodes/website-polish/step-1-dark-1440.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-ac734798a9595ab0b/docs/roadmaps/core/nodes/website-polish/step-2-dark-1440.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-ac734798a9595ab0b/docs/roadmaps/core/nodes/website-polish/step-3-dark-1440.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-ac734798a9595ab0b/docs/roadmaps/core/nodes/website-polish/step-4-dark-1440.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-ac734798a9595ab0b/docs/roadmaps/core/nodes/website-polish/step-1-light-390.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-ac734798a9595ab0b/docs/roadmaps/core/nodes/website-polish/step-2-light-390.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-ac734798a9595ab0b/docs/roadmaps/core/nodes/website-polish/step-3-light-390.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-ac734798a9595ab0b/docs/roadmaps/core/nodes/website-polish/step-4-light-390.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-ac734798a9595ab0b/docs/roadmaps/core/nodes/website-polish/steps-reduced-motion-1440.png` (the four static panels shown with `prefers-reduced-motion: reduce`)

After the merge the same files are in `docs/roadmaps/core/nodes/website-polish/` of the main checkout.

## Built

- `website/src/styles.css`: the Block tokens for light and dark, between `/* tokens:start */` and `/* tokens:end */`. It restyles the header, buttons, sidebar, prose, code blocks, pager and table of contents, and adds every landing section. Syntax colors are `--syn-*` tokens, so the inlined `@twinkleplop/theme-github` styles and that dependency are gone.
- `website/public/fonts/`: Bricolage Grotesque and Martian Mono as variable `woff2` files (latin subset, weights 200 to 800 and 100 to 800), with their OFL license files. Source: the npm packages `@fontsource-variable/bricolage-grotesque` 5.3.0 and `@fontsource-variable/martian-mono` 5.3.0, both `OFL-1.1`. Their license files credit github.com/ateliertriay/bricolage and github.com/evilmartians/mono, the same links the directions README gave.
- `website/src/demo/build.ts`: builds `examples/todo` with `createBuilder` and `idlip({ entry: '/src/entry-server.ts', skew: false })`. The base is `<BASE>demo/`. The client goes to `dist/client/demo/assets/` and the server entry to `dist/demo-server/`. The build renders `dist/client/demo/index.html` with the example's `render()`, then adds the site tokens and `src/demo/frame.css` inline. It also writes `dist/demo-server/demo.json`, which holds every file size (raw and gzip -9), the loader, the handler and binding chunk of the second checkbox, the `on:click` token, the handler's write set from `compile()`, the row markup, the state script and the todos. Chunk files come from the client build output: the one chunk whose module id holds the manifest's chunk name, such as `handler=toggle`. The site does not copy idlip's file naming rule. The build fails when the example stops matching the diagram: no row text, no second todo that starts not done, or a binding group that no longer patches the row and the count. The diagram takes every name and number from this file, including the count after the click.
- `website/vite.config.ts`: a `website:demo` plugin runs `buildDemo` in `closeBundle`. `scripts/build.ts` is unchanged and still calls `writeSite` after the Vite build.
- `website/src/landing/`: `index.ts` (hero, sample, page), `resume.ts` (the diagram), `demo.ts`, `features.ts`, `benchmarks.ts` and `format.ts`. `src/layout.ts` keeps the shared head, header, footer and the docs page.
- `website/src/benchmarks.json`: the date, machine, source file, framework columns and groups of metrics. Each metric has a unit, `better`, `noise` and one value per framework, with `null` meaning not run. `isBenchmarks` checks the shape at build time.
- `website/src/client.ts` imports every `src/client/*.ts` with `import.meta.glob`. The features are `theme.ts`, `copy.ts`, `resume.ts` and `demo.ts`. `src/client/lib/network.ts` exports `watchFrame(frame, panel)`, the network panel, for `website-repl` to reuse. A cached or 304 response shows `cached` instead of its header bytes. Client code formats sizes with `src/landing/format.ts`.
- Header: an empty `.header-slot` between the brand and the navigation, for `website-search`. The links come from `HEADER_LINKS` in `src/layout.ts`, so `website-repl` can add one.
- `website/DESIGN.md`: rewritten for Block, with the contrast table.
- `website/test/landing.test.ts`: the sections come in order, the diagram renders the stepper and four static panels, the demo frame and panel are present, every feature card links to an existing page, `benchmarks.json` has every field the table reads, the data shows both wins and losses, the verdict rule works, the hydration caption is present, there is exactly one `aria-live` element, and the group headers span every table column.
- `website/directions/` is deleted.

## Acceptance

- Screenshots: light and dark, 1440 and 390, of the landing page and `docs/resuming/`, listed above. At 390 px, `document.documentElement.scrollWidth` is 390 on all four pages.
- The demo resumes. On load the frame requests the document, `loader.<hash>.js` and `bricolage-grotesque.woff2` (shown as `cached` when the page already loaded it), so component code on load is 0 B. A click on the second checkbox requests exactly the `toggle` handler chunk and the `todos.*.done` binding chunk. A MutationObserver in the frame recorded these changes after the click: the `class` of `<li i-a="4">` and the text of the count (`0 left`). The panel shows both requests.
- Contrast: every text pair is 4.5:1 or more in both themes. The lowest is `--muted` on `--accent-tint` in dark at 5.1. `DESIGN.md` lists the ratios.
- Focus: every control uses the `:focus-visible` ring, 3px of `--focus`. That is olive `#436000` in light, 6.1:1 on the page, and chartreuse in dark.
- Reduced motion: every transition and animation duration is 0.001ms, the stepper is hidden, the four steps show as static panels, and the counters jump to their values instead of counting.
- `pnpm --filter website build && pnpm --filter website test && pnpm --filter website check:samples`: pass (27 pages, 20 tests, 47 samples with 0 problems). `rtk proxy pnpm lint`: exit 0, with no website findings. `pnpm format:check`: pass (659 files). `pnpm --filter website typecheck`: pass.

## Deviations

- **The click fetches both chunks.** The brief's step 4 says resumption fetches the binding chunk after the update reports the changed path. The real loader requests the handler chunk and the binding chunk of the handler's write set together on the click. The network log shows the binding request first. The diagram shows the truth: both requests at step 3, and at step 4 the binding chunk runs and patches.
- **The changed path is `todos.*.done`, not `todos.1.done`.** `diffPaths` reports the pattern path, and the binding chunk is named for the pattern. The diagram uses `todos.*.done`.
- **Two nodes get patched, not one.** The binding chunk patches the row's class and the count text, so both turn chartreuse. The checkbox checks on the click itself.
- **The hydration lane is a model.** idlip has no hydration build, since hydration is a non-goal. The lane uses the same build as if every component chunk loaded on start (10 chunks, 2.7 kB gzip). It counts TodoApp plus one run per row (3) on load, then one run for the handler and one for the update. A caption under the lanes says so: "Hydration lane: this same build with every component chunk loaded and run at start. idlip has no hydration build, so its numbers are a model, not a measurement."
- **The demo runs in an `<iframe>`.** Inlined into the landing page, the todo's `<main>` would sit inside the site's `<main>`. The frame keeps the example's document as it ships, and the panel can read its Resource Timing.
- **Panel sizes depend on the host.** They are what the frame's Resource Timing reports (`encodedBodySize`). `vite preview` compresses, so its numbers come close to the gzip numbers. The diagram uses gzip -9 sizes from the build.
- **The benchmarks link points to GitHub.** The site has no benchmarks page yet. The link goes to `benchmarks/README.md` on GitHub until a `docs/benchmarks.md` page exists, and then switches to it with no code change (`findBenchmarksLink`).
- **Scrolling drives the steps only on wide, tall screens.** That means at least 70rem wide with the stage fitting the viewport (a 1440x1000 window fits). Elsewhere the step buttons drive the steps. The brief allows scroll or buttons. In scroll mode a step button scrolls the page to its step and ignores the scroll on the way, until `scrollend` or 1.5 s. Clicking step 4 from step 1 now sets `data-step` once, to 4.
- **One live element.** The visible step sentences are `aria-hidden` in the stepper. One visually hidden `aria-live="polite"` element gets the current sentence on each step.
- **The benchmark caption comes from the data.** It reads the `noise` values in `benchmarks.json`: one margin gives "within N% of the best", and several give "within a row's noise margin".

## Stubs left

- None in the landing page. `website/README.md` is outside this node's owned paths. It still says `build` needs no other package, but the build now needs `pnpm --filter idlip build` first, since it compiles the demo. The orchestrator or the `website` node should update that line.

## Gotchas

- Playwright's element screenshot scrolls the element into view. In scroll mode that changes the step. Clip a viewport screenshot to the element's box instead.
- A file in `src/client/` with no import or export is a script to oxlint, so its functions count as globals (`no-implicit-globals`), and tsgolint loses the DOM types. Each feature file without an import ends with `export {};`.
- The demo frame's own `PerformanceObserver` class must watch its entries. One from the page would watch the page's requests. Entries from the frame fail `instanceof` against the page's classes, so `network.ts` checks the shape instead.

## Proposed learnings

- None.

## Verification

- Playwright (chromium from the `e2e` package) against `vite preview` of `website/dist/client` on port 48913, started by hand and stopped by PID.
- Contrast computed with the WCAG 2 formula from the token values.

## Size

- Estimated L, actual L.
