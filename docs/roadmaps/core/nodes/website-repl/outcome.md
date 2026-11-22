# Outcome: website-repl

## For the user

The site has a REPL at `/repl/`. A reader edits `*.idlip.tsx` files and `props.json`. The page compiles them, a dedicated Worker renders the first file on the server side, and a frame resumes it. The network panel of the landing demo lists what the frame loads, so a click shows the handler and binding chunks it fetches.

- **Examples.** Counter, Todo, Form, Subscription, Effect and Nesting. In Chromium, each one renders, resumes, and a click patches the frame and lists its chunks. Counter loads `counter.handler.increment.js` and `counter.binding.count.js` on the first click, 0 B of component code on load.
- **Output tabs.** Result (frame and network panel), JS (the server module and every client chunk as the compiler wrote them), State (the `<script i-state>` body), HTML (the server markup) and Problems (with a count).
- **Problems.** A compile error shows as a wavy underline at its position, as a list under the editor, and in the Problems tab. A click on a problem selects its range. A file tab with an error has a dot and an `aria-description` with the count.
- **Runtime errors.** A render that throws shows above the frame. A render that takes over 5 s is stopped with its Worker and shows "The render did not finish in 5 s.". An error in the frame (a throwing handler, a rejected promise, a script that fails to load, a loader `console.error`) shows as `In the frame: <message>`. The page keeps working in each case.
- **Links and what runs on open.** See "Run on open" below.
- **Files.** Add a file by name (`part.idlip.tsx` or `props.json`), delete any file but the first, and restore a deleted file with the "Restore <name>" button for 8 s.
- **Header and docs.** The header has a "REPL" link, marked `aria-current="page"` on `/repl/`. The search command bar's "Open the REPL" command goes there. Every `tsx` block that `check:samples` compiles has an "Open in REPL" link.

## Run on open

The hash of the REPL address has three forms. Only the first two run when the page opens, because their code comes from the site build, not from the link.

| Hash                      | Code comes from                                | Runs on open                                      |
| ------------------------- | ---------------------------------------------- | ------------------------------------------------- |
| `#example=<id>`           | `EXAMPLES` in `src/repl/examples.ts`           | yes                                               |
| `#sample=<page>-<n>`      | `repl/samples.json`, written by the site build | yes                                               |
| `#files=<base64url JSON>` | the link itself                                | no: the files compile, and the reader chooses Run |

- **Why a link cannot claim to be a sample.** `#example=` and `#sample=` carry only an id. The REPL looks the code up in data the site ships. A hand-made hash can only name code that is already on the site. An unknown sample id shows the counter and the message "This site has no docs sample <id>.".
- **Sample ids.** `loadPages` numbers the checked `tsx` blocks of each page from 1, for example `views-3` or `reference-idlip-2`. `writeSite` writes them to `dist/client/repl/samples.json` (26.9 kB, 47 samples).
- **Edits.** After an edit, the hash becomes `#example=<id>` or `#sample=<id>` while the files still match one. Otherwise it becomes `#files=`. So a reload of edited code compiles but does not run. Once the reader chooses Run, later edits in that page run on their own.
- **Duplicate names.** A `#files=` hash with two files of one name is rejected and reads as no hash.

## Isolation limit

The frame runs the code with the site's origin and has no sandbox, so frame code can reach the REPL page and the site's storage. The Run button and the render Worker make that code run only after the reader asks for it, and keep the server render out of the page's realm. They do not isolate the frame. Full isolation needs the frame on a separate origin. That is a hosting decision, which the coordinator recorded in the roadmap inbox.

Screenshots (counter after one click, a shared link waiting for Run, and a syntax error):

- `docs/roadmaps/core/nodes/website-repl/repl-light-1440.png`
- `docs/roadmaps/core/nodes/website-repl/repl-dark-1440.png`
- `docs/roadmaps/core/nodes/website-repl/repl-light-390.png`
- `docs/roadmaps/core/nodes/website-repl/repl-dark-390.png`
- `docs/roadmaps/core/nodes/website-repl/repl-waiting-light-1440.png`
- `docs/roadmaps/core/nodes/website-repl/repl-waiting-dark-1440.png`
- `docs/roadmaps/core/nodes/website-repl/repl-error-light-1440.png`
- `docs/roadmaps/core/nodes/website-repl/repl-error-dark-1440.png`
- `docs/roadmaps/core/nodes/website-repl/docs-open-in-repl-light-1440.png`

The 390 px full-page shots show the sticky header part way down. That is how Playwright stitches a full-page shot of a sticky header, not the layout. The error and docs shots predate the review fixes, which did not change those views.

## Built

- `website/src/repl/project.ts`: `compileProject(files)` compiles every file with `idlip/compiler`, finds children with `listChildren`, reads `props.json`, and returns the problems with line and column. The REPL page runs it.
- `website/src/repl/chunks.ts`: `listChunks` names each client chunk `<file>.<kind>.<name>.js` and points its imports at the run. `writeFrameShim` writes the module the chunks import `idlip/client` and `idlip` from. It imports no compiler and no runtime.
- `website/src/repl/render.ts`: `renderProject` turns each server module into a module URL (blob in the Worker, data URL in Node), points its `chunks` table at the run folder, and calls `renderPage` from `idlip/server`.
- `website/src/repl/worker.ts` and `protocol.ts`: the render Worker and its messages. The page sends the compiled project and the chunks, and the Worker answers `rendered` or `failed`.
- `website/src/repl/run.ts`: compiles, asks the Worker to render with a 5 s limit, registers the service worker, and stores the run in Cache Storage (`idlip-repl`). On timeout it terminates the Worker, and the next run starts a new one.
- `website/src/repl/sw.ts`: a module service worker. It answers GET requests under its scope from the cache, and lets every other request through.
- `website/src/repl/runtime.ts`: the frame's loader. It imports `idlip` and `idlip/client` (which boots `resume`) and puts their exports on `globalThis.__idlipFrame`.
- `website/src/repl/app.ts`, `editor.ts`, `highlight.ts`, `icons.ts`: the page. The status is one union: `loading`, `compiling`, `waiting`, `running`, `ran`, `blocked`, `failed`. Each run gets a number, and the answer of an older run is dropped.
- `website/src/repl/examples.ts`: the six examples. Todo and Nesting import `examples/todo` and `examples/counters` with `?raw`, so the REPL runs the same code as the e2e tests.
- `website/src/repl/files.ts`: the three hash forms, the `#files=` encoding, and `getSampleLink`.
- `website/src/repl/page.ts`: the `/repl/` shell. It inlines `repl.css` and puts the frame styles in a `<template>`.
- `website/test/repl.test.ts`: 15 tests. Every example compiles and renders in Node through data URLs, and its chunk imports point at the run. Share links round-trip and reject broken hashes and duplicate names. Example and sample hashes carry only ids. `loadPages` collects over 40 samples and links `views-1`. Problems are reported for syntax, missing child files and broken props. The page shell loads only `site.js`. The wasm binding version in `website/package.json` equals the version of the `oxc-parser` that `idlip` resolves.

## Run folders and the cache

- **Per page.** Each REPL page takes a `crypto.randomUUID()` id. Its runs go to `<scope>/repl-run/<page id>/<run>/`.
- **Clean up.** Storing a run deletes this page's older runs. It also deletes runs of other pages stored over an hour ago, read from an `x-idlip-repl-time` header on each cached response. Runs of other open pages stay, so two tabs no longer break each other.
- **Insecure origin.** Without a service worker (no HTTPS or localhost), the files still compile and the JS and Problems tabs fill. Only the run fails, with a message above the frame.

## Spike

The compiler had one Node-only import on the compile path: `import { posix } from 'node:path'` in `packages/idlip/src/compiler/view/codegen/index.ts`. `packages/idlip/src/compiler/view/codegen/path.ts` now holds `resolveSpecifier` with ports of `posix.dirname` and `posix.normalize`. A fast-check test compares it with `posix.join(posix.dirname(importer), specifier)` over 5000 cases, with specifiers `.`, `..`, `.h`, `./x`, `../x` and `.h/x`, rooted and relative importers, and trailing slashes. `oxc-parser` runs in the browser through `@oxc-parser/binding-wasm32-wasi` 0.159.0, aliased the way brumate does.

## Files outside the owned paths

| File                                                     | Change                                                                                                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/idlip/src/compiler/view/codegen/index.ts`      | Imports `resolveSpecifier` from `path.ts` instead of using `node:path`.                                                                                      |
| `packages/idlip/src/compiler/view/codegen/path.ts`       | New. The POSIX path steps, without `node:path`.                                                                                                              |
| `packages/idlip/test/compiler/view/codegen/path.test.ts` | New. Property test against `node:path`.                                                                                                                      |
| `website/src/client/repl.ts`                             | New. Imports `../repl/app.ts` only when the page has `[data-repl]`, and passes it `watchFrame`.                                                              |
| `website/src/markdown.ts`                                | `createRenderer` takes `{ sampleLink }`, and the fence rule adds the "Open in REPL" link and the `has-repl` class.                                           |
| `website/src/search/index.ts`                            | `htmlToText` drops `<a class="code-repl">`, so the search index holds no "Open in REPL" text.                                                                |
| `website/src/site.ts` (shared)                           | `loadPages` collects the samples and links them by id. `writeSite` writes `repl/samples.json`. `renderSite` writes `repl/index.html`.                        |
| `website/src/layout.ts` (shared)                         | Adds the "REPL" link to `HEADER_LINKS`. `renderHeader` takes an optional `current` label for `aria-current`.                                                 |
| `website/src/styles.css` (shared)                        | `.code-repl` and the `has-repl` offset for the language tag, next to the `.code-copy` rules.                                                                 |
| `website/vite.config.ts` (shared)                        | The wasm alias, `optimizeDeps.exclude`, `worker.format: 'es'`, `modulePreload: false`, `chunkSizeWarningLimit: 700`, and `minify` with `keepNames.function`. |
| `website/package.json`, `pnpm-lock.yaml` (shared)        | `@oxc-parser/binding-wasm32-wasi` 0.159.0, the version of idlip's `oxc-parser`. A test fails when they differ.                                               |

## Chunk sizes

Measured on `dist/client/assets` after `pnpm --filter website build`, gzip -9.

| File                       | Raw       | Gzip     | Loads on                                              |
| -------------------------- | --------- | -------- | ----------------------------------------------------- |
| `site.js`                  | 8.6 kB    | 3.2 kB   | every page                                            |
| `preload-helper-*.js`      | 2.0 kB    | 0.9 kB   | every page (Vite's `import()` helper)                 |
| `app-*.js`                 | 177.6 kB  | 53.6 kB  | `/repl/` (UI, examples, highlighter)                  |
| `files-*.js`               | 1.7 kB    | 0.8 kB   | `/repl/`                                              |
| `run-*.js`                 | 429.7 kB  | 106.2 kB | `/repl/`, after the UI (compiler)                     |
| `site.wasm`                | 1654.5 kB | 563.5 kB | `/repl/`, with `run` (the oxc parser)                 |
| `wasi-worker-browser-*.js` | 238.6 kB  | 54.6 kB  | emitted by the wasm binding for its threads           |
| `worker-*.js`              | 46.4 kB   | 16.4 kB  | `/repl/`, on the first run (server renderer, seroval) |
| `runtime-*.js`             | 25.3 kB   | 9.1 kB   | the REPL frame (the loader)                           |
| `sw-*.js`                  | 0.5 kB    | 0.3 kB   | `/repl/` (service worker)                             |

`site.js` includes website-search's code since the rebase. Docs pages: Playwright recorded `site.js` and `preload-helper-*.js` on `docs/views/`, with no REPL chunk and no wasm.

## Acceptance

Chromium, Playwright against `vite preview` of `website/dist/client` (port 48933, started and stopped by task ID), after the review fixes:

- **Examples.** All six render, resume, change the frame text on a click, and list the click's chunks in the panel.
- **Two tabs.** Tab A runs Counter, tab B opens Todo, and a click in tab A still loads its chunks with no error.
- **Shared link.** It compiles, fills the JS tab, sets no frame, and waits. Run then runs it (`props.json` `{"start": 41}` gave `41`). A reload waits again.
- **Docs sample.** `#sample=views-1` runs on open and keeps its hash. `#sample=nope-9` shows the counter and the message.
- **Timeout.** A render with an endless loop fails after 5.4 s with "The render did not finish in 5 s.". The next edit runs again.
- **Search.** "Open the REPL" in the command bar goes to `/repl/`, which runs.
- **Keyboard.** The output tabs and file tabs move with the arrow keys, Home and End. Every control has the site's `:focus-visible` ring.
- **Width.** Light and dark at 1440 and 390: `scrollWidth` equals the viewport width.

Commands:

| Check                                                       | Result                            |
| ----------------------------------------------------------- | --------------------------------- |
| `pnpm --filter website build && pnpm --filter website test` | pass, 28 pages, 52 tests          |
| `pnpm --filter website check:samples`                       | 47 samples, 0 problems            |
| `pnpm --filter website typecheck`                           | pass                              |
| `pnpm --filter idlip test`                                  | 669 tests pass                    |
| `rtk proxy pnpm lint`                                       | exit 0, no findings in `website/` |
| `pnpm format:check`                                         | pass, 691 files                   |

## Deviations

- **The page compiles, the Worker renders.** The review asked for the server render in a Worker, which it is. Compiling in the Worker hung: the wasm parser starts its own thread workers, and the instantiation never finished inside a Worker in Chromium. Compiling runs no code from the files.
- **A service worker serves the run.** Blob URL imports do not appear in Resource Timing in Chromium (checked), so the panel would show nothing on a click. The frame loads from a service worker scope instead, and the panel reads real requests.
- **The frame imports the runtime through a blob shim.** Vite builds `runtime.ts` as a worker bundle, which drops exports. `runtime.ts` sets `globalThis.__idlipFrame`, and the chunks import a blob module that re-exports from it. The panel does not list the shim.
- **Function names stay in the site bundle.** The compiler copies its helpers into chunks by `toString()` and throws when a helper is renamed (`core/helpers.ts`). The site build keeps function names and still mangles other names.
- **Docs pages load one more small file.** `preload-helper-*.js` (0.9 kB gzip) is Vite's helper for `import()`. It holds no REPL code.
- **Only `*.idlip.tsx` and `props.json` run.** A docs sample that imports `./api.ts` or a sibling component opens with a `repl-import` problem.
- **Docs samples open with `props.json` set to `{}`.** A sample that reads a prop renders with it undefined, or shows the render error.

## Stubs left

- None.

## Gotchas

- `createRenderer`'s fence rule has a parameter named `options`, so the renderer setting is called `settings`.
- A data URL import inside another data URL breaks on `'`. `createDataUrl` encodes it as `%27`.
- The status goes to `compiling` on each edit, before the debounce, so the frame never looks current for code it does not run.
- A module Worker that loads the oxc wasm binding never finishes instantiating in Chromium. Keep the compiler on the page.

## Proposed learnings

- The idlip compiler cannot run from a bundle that renames function names. Any bundle that ships `idlip/compiler` needs `keepNames.function` or no mangling.

## Uncertain

- Firefox and Safari were not checked. The service worker is registered with `type: "module"`, which older browsers reject.
- The insecure-origin path was checked by reading the code, not in a browser.

## Size

- Estimated L, actual L.
