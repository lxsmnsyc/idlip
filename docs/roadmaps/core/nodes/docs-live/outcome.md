# Outcome: docs-live

## For the user

Code samples on the docs pages and the landing page run in the page. A reader sees each result as a static page the build wrote, which resumes on a click. Editing the code reruns it 400 ms after typing stops, with no trip to the REPL.

- **Live samples.** 41 on 15 docs pages, plus the landing counter. Pages: `views` (8), `reference/idlip` (8), `reference/syntax` (4), `forms` (3), `svg-and-html` (3), `components` (2), `dynamic-paths` (2), `effects` (2), `head` (2), `subscriptions` (2), `editor`, `errors`, `getting-started`, `global-events`, `refs` (1 each).
- **Each sample** has file tabs, a status in its bar, a REPL icon button, a Copy button, the code, a problem list, and Result and Compiled tabs.
- **Compiled tab.** It lists the server module and each client chunk with its gzip size and when it loads. A row opens to show the code. Before an edit, the tab is the file the build wrote. After an edit, it shows the run.
- **Props.** 15 samples that read props got a `props.json` tab with example values. Editing `props.json` reruns the sample (landing: `"start": 41` shows `41` and `Double: 82`).
- **REPL link.** No "Open in REPL" text link is left on the docs pages. Each live sample has an icon button, "Open this code in the REPL".
  - A one-file sample links to `#sample=<id>`, which runs.
  - A sample of several files links to `/repl/`. The page adds the `#files=` hash on hover or focus, and the REPL waits for Run. Page HTML holds no base64 files.
  - The landing sample has no REPL button.
- **Code from the address.** A docs page never runs code from its URL or hash. A sample runs the code the build put in the page, or the reader's own edits.

## Markup

- ` ```tsx live ` starts a sample. The first file's name comes from its default export (`TodoApp` gives `todo-app.tsx`), else `app.tsx`. ` ```tsx live name.tsx ` sets it.
- A named fence right after a sample is one more file: ` ```tsx live part.tsx ` or ` ```json live props.json `. Blank lines between the fences are fine (oxfmt adds them).
- A bad file name, a duplicate name, or a sample that starts with a `json` fence fails the build with `docs/<page>.md:<line>: <reason>`.
- `website/README.md` documents the fences and the load model.
- No-JS fallback: each file shows as highlighted code with its name above it. Tabs, Copy and the output are hidden.

## What loads when

The build writes `live/<page>-<n>/` for each sample: `index.html` (the server render with the inline listener and the loader), the client chunks, `idlip.js` (the shim the chunks import the loader from) and `compiled.html`. The result area holds an `<iframe loading="lazy">` of that page.

Measured in Chromium with Playwright on `vite preview`. Gzip -9 of each body, each URL counted once:

| Who                                      | `/docs/views/` (8 samples)                                    | `/` (1 sample) |
| ---------------------------------------- | ------------------------------------------------------------- | -------------- |
| Page scripts and styles, no samples      | 13.6 kB (`site.css` 8.4, `site.js` 4.3, `preload-helper` 0.9) | same           |
| Sample script (`sample-*.js` and icons)  | 3.0 kB                                                        | 3.0 kB         |
| Loader `runtime-*.js`, once              | 9.1 kB                                                        | 9.1 kB         |
| `live/frame.css`, once                   | 1.7 kB                                                        | 1.7 kB         |
| Frame pages, 1.6 to 1.9 kB each          | 13.9 kB                                                       | 1.8 kB         |
| Reader total for the samples             | 27.7 kB, no service worker                                    | 15.6 kB        |
| Reader scripts and styles, no frame HTML | 27.4 kB                                                       | 27.4 kB        |
| A click in a frame                       | that event's chunks, 0.1 to 0.6 kB each                       | same           |
| Editor, on top                           | 740.5 kB, one service worker                                  | 740.4 kB       |

- **Reader target.** The review asked for about 17 kB on `/docs/views/`. Scripts and styles of a reader come to 27.4 kB: the page's own 13.6 kB, the 9.1 kB loader, the 3.0 kB sample script and the 1.7 kB frame styles. The 8 frame pages add 13.9 kB. About 1 kB of each is the inline listener, which every idlip page carries.
- **Editor.** On hover over the code: `session-*.js` (1.9 kB) and `editor-*.js` (47.4 kB, editor and grammars). On the first focus or key: the same, if hover did not load them. On the first edit: `run-*.js` (107.1 kB, compiler), `site.wasm` (565.0 kB), `worker-*.js` (16.5 kB), `files-*.js` (0.8 kB), the service worker and the run page.
- **Pages with no live sample** (`/docs/resuming/`) load nothing extra.
- With `vite preview` the loader and `frame.css` were requested once per frame and the browser reused the body. A host that caches `/assets/` (hashed names) and `/live/` serves them once.

## How it runs

- `src/live/fence.ts` groups the fences. `src/markdown.ts` turns each group into one `live_sample` token. `src/live/markup.ts` writes the HTML for the docs and the landing page.
- `src/live/prebuild.ts` writes the static frames after the Vite build. It renders each sample in Node through data URLs and finds the loader by its `runtime-*.js` name in `assets/`.
- `src/client/live.ts` observes `[data-live-sample]` (400 px ahead) and imports `src/live/sample.ts`. That script imports no editor, highlighter or compiler. It adds the textarea, sizes the frame from its body height, syncs the theme, runs the tabs, and fetches `compiled.html` the first time the Compiled tab opens.
- Before the editor loads, a key shows as plain text over the code, so typing does not wait on the network.
- `src/live/session.ts` takes over on the first focus or key. It loads `repl/editor.ts` and `repl/highlight.ts`, and on the first edit `repl/run.ts`. A failed load of either chunk is not cached. The bar shows "Failed" and the result area shows "Could not load the compiler. Check the connection.". The next edit tries again.
- Each sample gets its own runner (`repl/runner.ts`, `createRunner`): its own folder in the `idlip-repl` cache and its own run counter. Only the latest run of a sample writes its result. The frame switches from the static page to the run.
- `repl/requests.ts` shares one render Worker. A render over 5 s ends the worker. Only that request fails. The other requests go to a new worker, each with a new 5 s limit. The page revokes the module URLs the ended worker had reported.
- `repl/answer.ts` (the worker's work for one request) revokes that request's module URLs when its render ends, so two concurrent renders do not break each other.
- Frames are as isolated as the REPL frame: same origin, no sandbox.

## States

Checked in Chromium with Playwright against `vite preview` on port 48800 (stopped after):

- **Reader.** The static frame shows the render. A click resumes (`Open` to `Close`, loading `live/views-2/panel.handler.toggle.js` and `panel.binding.open.js`). No compiler, no worker, no service worker.
- **Loading.** Spinner and "Loading" while the editor chunk loads.
- **Running.** Spinner and "Running" at once on each key. The old frame dims to 45% opacity.
- **Ready.** The run's frame loads and the status clears.
- **Compile error.** "1 error" with an icon, a wavy underline, and a problem row that selects its range on click.
- **Render error.** "Failed" and `The server render failed: Render failed on purpose`. The next good edit clears it.
- **Timeout.** `The render did not finish in 5 s.` while the other sample stays ready. The next edit runs.
- **Load failure.** With `run-*.js` blocked: "Failed" and "Could not load the compiler. Check the connection.". After unblocking, the next key runs and the message goes.
- **Two samples.** Editing both on `/docs/views/` gives two runs, each in its own frame and folder.
- **Copy before start.** On the last sample of `/docs/views/`, before its script ran, Copy put the source on the clipboard with no extra newline.
- **Keyboard.** Tab indents. Escape then Tab moves on. A visually hidden hint, linked by `aria-describedby`, says so. Tabs move with the arrow keys, Home and End.
- **Reduced motion.** Transitions end at once. The spinner has `animation: none`.
- **390 px, dark.** `scrollWidth` 390. Tabs, the REPL button and Copy are 44 px under `pointer: coarse`.
- **No JS.** Code visible with file names, output hidden.
- **REPL.** `#example=counter` runs. A multi-file sample's link, after hover, opens its two files in the REPL, waiting for Run.

## Checks

| Check                                 | Result                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `pnpm --filter website build`         | pass, 28 pages, 42 static frames                                                                       |
| `pnpm --filter website test`          | 108 tests in 9 files pass                                                                              |
| `pnpm --filter website check:samples` | 47 samples, 41 live, 0 problems                                                                        |
| `pnpm --filter website typecheck`     | pass                                                                                                   |
| `pnpm --filter e2e typecheck`         | pass                                                                                                   |
| `e2e/tests/website-live.spec.ts`      | 4 passed (`E2E_TARGET=fixture`, `--project chromium`)                                                  |
| `rtk proxy pnpm lint`                 | no finding in `website/` or `e2e/`                                                                     |
| `pnpm exec oxfmt --check .`           | only `docs/roadmaps/core/nodes/landing-trim/outcome.md`, which was unformatted on `batch/core` already |

Tests:

- `test/live.test.ts`: fence parsing, the no-JS markup, the static frame tag, the REPL links with no files in the HTML, every docs sample compiles and renders, and the lazy load of the sample script.
- `test/live-pipeline.test.ts`:
  - the requester with a fake worker: only the slow request fails, the others get a new 5 s limit, and the page revokes the ended worker's URLs;
  - the per-request revoke of `answerRequest`;
  - `createRunner` with fake services, which gives each runner its own folder;
  - `prebuildLiveSamples`, which writes the page, chunks, shim and Compiled tab, and fails on a sample that does not render.
- `e2e/tests/website-live.spec.ts`: reader with no compiler and a resuming frame, edit and rerun, two samples, compile error, timeout and recovery. It starts `vite preview` of `website/dist` itself on `E2E_WEBSITE_PORT` (default 4590). It skips when the website is not built, and CI builds only `packages/*` and `examples/*`. To run it in CI, `check.yml` needs `pnpm --filter website build` before `pnpm --filter e2e test`.

## Files outside the owned paths

| File                                    | Change                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------ |
| `website/scripts/check-samples.ts`      | Runs `checkLiveSamples` and `renderLiveSamples`. The brief asked for this.                 |
| `website/scripts/build.ts`              | Awaits `writeSite`, which now writes the static frames.                                    |
| `website/src/client/copy.ts`            | Copy in a live sample reads the sample's first file before the sample's script starts.     |
| `website/README.md`                     | The live fences and the load model. The review allowed this.                               |
| `e2e/tests/website-live.spec.ts`        | New. The review asked for an e2e spec.                                                     |
| `website/src/site.ts` (shared)          | Collects live samples, their ids and links. `writeSite` checks them and writes the frames. |
| `website/src/landing/index.ts` (shared) | The landing sample is live, with its static frame `live/landing-1/`.                       |
| `website/src/styles.css` (shared)       | Live sample styles. The `.code-repl` rules are gone.                                       |
| `website/test/landing.test.ts` (shared) | Install tab counts scoped to the install tabs. Checks for the live landing sample.         |

## Not done

- **Static samples left.** `nesting.md` (2) and `reference/syntax.md`'s `Board` need a sibling `counter.tsx` file, and `nesting.md` belongs to another worker. `components.md`'s `Counter` and `Cart` need a `props.json` fence, which is more than a fence info edit. The `index.md` fragment stays static.
- **The e2e spec skips in CI** until CI builds the website (see Checks).
- **Reader bytes** are 27.4 kB of scripts and styles on `/docs/views/`, above the 17 kB the review named. The loader (9.1 kB) is the largest part.
- **`search/index.ts`** still drops `<a class="code-repl">`, which no page has now. Harmless.

## Uncertain

- Firefox and Safari were not checked. `CompressionStream` (gzip sizes after an edit) needs Safari 16.4 or later.
- A lazy iframe does not follow a new `src` in Chromium, so the session sets `loading = 'eager'` before it switches the frame to a run. Other browsers were not checked.

## Size

- Estimated L, actual L.
