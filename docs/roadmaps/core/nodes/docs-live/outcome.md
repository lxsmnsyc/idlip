# Outcome: docs-live

## For the user

Code samples on the docs pages and the landing page run in the page. The reader edits the code and the result updates 400 ms after typing stops, with no trip to the REPL.

- **Live samples.** 41 on 15 docs pages, plus the landing counter. Pages: `views` (8), `reference/idlip` (8), `reference/syntax` (4), `forms` (3), `svg-and-html` (3), `components` (2), `dynamic-paths` (2), `effects` (2), `head` (2), `subscriptions` (2), `editor`, `errors`, `getting-started`, `global-events`, `refs` (1 each).
- **Each sample** has file tabs, a status in its bar, a REPL icon button, a Copy button, the editor, a problem list, and Result and Compiled tabs. The Compiled tab lists the server module and each client chunk with its gzip size and when it loads ("loads on its event", "loads when its value changes"). A row opens to show the code.
- **Props.** 15 samples that read props got a `props.json` tab with example values, so they render real content. Editing `props.json` reruns the sample (landing: `"start": 41` shows `41` and `Double: 82`).
- **REPL link.** The "Open in REPL" text links are gone from every docs page. Each live sample has a quiet icon button, "Open this code in the REPL". A one-file sample opens as `#sample=<id>` and runs. A sample with several files, or an edited one, opens as `#files=` and waits for Run, as any shared link does. The landing sample has no REPL button.

## Markup

- ` ```tsx live ` starts a sample. The first file's name comes from its default export (`TodoApp` gives `todo-app.tsx`), else `app.tsx`. ` ```tsx live name.tsx ` sets it.
- A named fence right after a sample is one more file: ` ```tsx live part.tsx ` or ` ```json live props.json `. Blank lines between the fences are fine (oxfmt adds them).
- A bad file name, a duplicate name, or a sample that starts with a `json` fence fails the build with `docs/<page>.md:<line>: <reason>`.
- No-JS fallback: each file shows as highlighted code with its name above it. Tabs, Copy and the output are hidden. With JS, before the sample loads, the first file shows and the output area is already in place.

## What loads when

Measured on `dist/client` after `pnpm --filter website build`, gzip -9. Playwright recorded the requests on `/docs/getting-started/` and `/`. On load: the page, `site.css`, `site.js`, `preload-helper-*.js`. No sample code. The rest loads when the first sample is within 400 px of the viewport:

| File             | Raw       | Gzip     | Loads                                                      |
| ---------------- | --------- | -------- | ---------------------------------------------------------- |
| `site.js`        | 12.3 kB   | 4.2 kB   | every page (includes `client/live.ts`, the observer)       |
| `sample-*.js`    | 7.9 kB    | 3.2 kB   | first sample near the viewport                             |
| `icons-*.js`     | 159.2 kB  | 47.4 kB  | same time (editor, highlighter grammars, shared with REPL) |
| `files-*.js`     | 1.7 kB    | 0.8 kB   | same time                                                  |
| `live/frame.css` | 5.5 kB    | 1.7 kB   | same time (frame stylesheet, written by the site build)    |
| `run-*.js`       | 430.2 kB  | 106.3 kB | same time (compiler)                                       |
| `site.wasm`      | 1654.5 kB | 559.0 kB | same time (oxc parser)                                     |
| `worker-*.js`    | 46.4 kB   | 16.4 kB  | first render (server renderer)                             |
| `runtime-*.js`   | 25.3 kB   | 9.1 kB   | each frame (the loader)                                    |

A page with no live sample (`/docs/resuming/`) loads nothing extra. On `/docs/views/` the first sample is near the top, so the pipeline loads at once there.

## How it runs

- `src/live/fence.ts` groups the fences. `src/markdown.ts` turns each group into one `live_sample` token. `src/live/markup.ts` writes the HTML for the docs and the landing page.
- `src/client/live.ts` observes `[data-live-sample]` with `rootMargin: 400px 0px` and imports `src/live/sample.ts` once.
- `src/live/sample.ts` reads the files from the highlighted code (its text is the source plus one newline), adds the textarea and marks layer, and reuses `repl/editor.ts` and `repl/highlight.ts`.
- Each sample gets its own runner from `createRunner()` in `repl/run.ts`: its own folder in the `idlip-repl` cache and its own run counter. The page compiles, the shared render Worker renders, and the sample's own frame loads the run through the service worker. Only the latest run of a sample writes its result.
- The frame reports its body height through `postMessage` (`idlipHeight`). The frame takes that height. The result area keeps `min-height: 8rem`, so the page does not move while the sample loads or reruns.
- Frames are as isolated as the REPL frame: same origin, no sandbox, served from the service worker scope. The code that runs on load comes from the site build. Edits are the reader's own.

## States

Checked in Chromium with Playwright against `vite preview` on port 48800 (stopped after):

- **Idle.** Before the sample nears the viewport: highlighted code and an empty result area.
- **Loading.** Spinner and "Loading" in the bar while the compiler loads.
- **Running.** Spinner and "Running" at once on each key. The old frame dims to 45% opacity until the new run lands.
- **Result.** Status clears. A click in the frame resumes (landing `+` gives `1` and `Double: 2`).
- **Compile error.** "1 error" in red with an icon, a wavy underline at the position, and a problem row (`11:14 Unexpected token`). A click on the row selects the range.
- **Render error.** "Failed" and `The server render failed: Render failed on purpose` in the result area.
- **Timeout.** An endless loop gives `The render did not finish in 5 s.` The other sample on the page stays `ran`. The next edit runs again.
- **Frame error.** Errors in the frame show as `In the frame: <message>`, as in the REPL.
- **Two samples.** On `/docs/views/`, editing sample 2 reruns it while sample 1 stays `ran`, and sample 1's frame still has its controls.
- **Keyboard.** Tab indents in the editor. Escape then Tab moves on. A visually hidden hint, linked by `aria-describedby`, says so. File and output tabs move with the arrow keys, Home and End.
- **Reduced motion.** Transitions end at once (`1e-06s`). The spinner stands still.
- **390 px, dark.** `scrollWidth` 390 on `/docs/views/` and `/`. The editor scrolls sideways. Tabs and the REPL button are 44 px under `pointer: coarse`.
- **No JS.** Code visible with file names, output hidden.

The REPL still runs `#example=counter` and `#sample=views-2`.

## Checks

| Check                                 | Result                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `pnpm --filter website build`         | pass, 28 pages                                                                                         |
| `pnpm --filter website test`          | 99 tests in 8 files pass (new: `live.test.ts`, 13)                                                     |
| `pnpm --filter website check:samples` | 47 samples, 41 live, 0 problems                                                                        |
| `pnpm --filter website typecheck`     | pass                                                                                                   |
| `rtk proxy pnpm lint`                 | no finding in `website/`                                                                               |
| `pnpm exec oxfmt --check .`           | only `docs/roadmaps/core/nodes/landing-trim/outcome.md`, which was unformatted on `batch/core` already |

`check:samples` now also compiles each live sample as one project with its files, and renders it on the server side in Node. The site build compiles the live samples and fails on an error.

## Files outside the owned paths

| File                                    | Change                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `website/scripts/check-samples.ts`      | Runs `checkLiveSamples` and `renderLiveSamples` from `src/live/check.ts`. The brief asked for this.          |
| `website/src/site.ts` (shared)          | `loadPages` collects live samples and their REPL links. `writeSite` checks them and writes `live/frame.css`. |
| `website/src/landing/index.ts` (shared) | The landing sample is `renderLiveSample` of `counter.tsx` and `props.json`.                                  |
| `website/src/styles.css` (shared)       | Live sample styles. The `.code-repl` rules are gone.                                                         |
| `website/test/landing.test.ts` (shared) | Install tab counts scoped to the install tabs. New checks for the live landing sample.                       |

## Not done

- **Static samples left.** `nesting.md` (2) and `reference/syntax.md`'s `Board` need a sibling `counter.tsx` file, and `nesting.md` belongs to another worker. `components.md`'s `Counter` and `Cart` need a `props.json` fence, which is more than a fence info edit. Add the props fences once that page is free. The `index.md` fragment stays static.
- **README.** `website/README.md` does not describe `tsx live` yet. It is outside the owned paths. It needs one item: "`tsx live`, `tsx live name.tsx`, `json live props.json`: a live sample. Compiled and rendered by `check:samples`."
- **`search/index.ts`** still drops `<a class="code-repl">`, which no page has now. Harmless.
- **Chunk name.** Rollup names the shared editor and highlighter chunk `icons-*.js`.

## Uncertain

- Firefox and Safari were not checked. `CompressionStream` (gzip sizes) needs Safari 16.4 or later.
- `site.js` grew by the size of `client/live.ts`. It was not measured on its own.

## Size

- Estimated L, actual L.
