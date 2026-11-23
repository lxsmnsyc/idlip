# Outcome: repl-origin

## For the user

Reader code no longer runs on the site's origin. The REPL frame, the frame of a live sample after an edit and the render step are sandboxed with `allow-scripts` and no `allow-same-origin`, so they have an opaque origin. It needs no hosting change: no second origin, subdomain or Vercel project.

- **What the frame cannot do.** Read `parent.document`, the site's `localStorage` or cookies, navigate the page, submit forms, open popups or modals. It can run scripts and send messages to the page.
- **What changed to make that work.** A frame without an origin cannot load from the service worker, so the service worker is gone. The page writes the whole frame document (`srcdoc`), loader and chunks inside. The frame makes blob URLs and an import map points each chunk URL at its blob, so the loader still resumes on `import()` as before. The page and the frame talk only by `postMessage`: theme and a height request go in, errors, height and chunk reports come out. The page checks `event.source` and that the origin is `null` (or its own, for the static frame).
- **The render step.** The render worker used to be a worker of the page, with the site's origin, so top-level code of a share link could fetch the site with credentials. It now runs in a worker made inside a hidden sandboxed frame (`render-host.ts`): the page sends the bundle's code, the frame makes a classic worker from a blob, and messages go through the frame. Chromium does not load a module worker from a blob without an origin, so the worker is classic.
- **Old runs.** The REPL page unregisters the old service worker under `repl-run/` and deletes the `idlip-repl` cache for returning visitors.
- **The network panel of the REPL** is fed by chunk reports from the frame. Each chunk the frame runs shows as a row, split into load and events at the first pointer or key event. Sizes are the bytes of the code, not network bytes, and the loader and the shim do not show as rows.
- **Static live-sample frames stay on the site's origin.** They run only the site's own build, no reader code, so they have no `sandbox`. The attribute is set on the first edit, before the new document loads. The landing demo frame is also the site's own build and is unchanged.
- **Costs the user may notice.** The site's web fonts do not load in the frame (CORS from origin `null`), so it shows system fonts. Reader code cannot use `localStorage`, cookies or forms.
- **Hosting.** Nothing to decide for this node. A second origin would also allow storage in the frame, but it is not needed for isolation.

## Built

- `website/src/repl/frame-document.ts`: the bridge in every frame (errors, height, theme by message) and `writeSandboxDocument`, which embeds the chunks and the loader.
- `website/src/repl/sandbox.ts`: the `sandbox` value.
- `website/src/repl/render-host.ts`: the sandboxed frame that holds the render worker.
- `website/src/repl/runner.ts`, `run.ts`: the runner returns the document as `srcdoc`. The service worker, its cache and `sw.ts` are removed.
- `website/src/repl/app.ts`, `page.ts`, `website/src/live/session.ts`, `sample.ts`: sandbox attribute, `srcdoc`, message based theme, height and errors.
- `website/src/client/lib/network.ts`: `createMessagePanel`, the panel for a frame the page cannot observe. `watchFrame` stays for the landing demo.
- `e2e/tests/website-repl.spec.ts`: the isolation test. `e2e/tests/website-live.spec.ts` reads the run title through Playwright, since the page cannot.
- `website/test/live-pipeline.test.ts`: runner tests for the new document.
- `website/README.md`: an Isolation section.

## Acceptance

- `e2e/tests/website-repl.spec.ts`, "the REPL frame is sandboxed without an origin": the site sets `localStorage` and a cookie, and a share link runs a click handler that reads `window.parent.document`, `window.localStorage`, `document.cookie` and `window.top.location`. The frame shows `document:blocked storage:blocked cookie:blocked top:blocked origin:null`, and the site's storage and cookie are unchanged. A second test runs the same probe in a live sample after an edit. A third runs module top-level code and a component: a credentialed `fetch('/repl/')` is blocked, `globalThis.origin` is `null`, and no `status:` text appears. Removing the `sandbox` attribute by hand makes the same probe read the page title and `leaked`.
- The REPL (counter example) resumes, a click updates the page, and the panel lists `counter.handler.increment.js` under events. Live samples edit, show compile errors and time out as before (`website-live.spec.ts`, 4 tests).
- `pnpm --filter website build && pnpm --filter website test`: pass (136 tests). `pnpm typecheck`, `pnpm lint` (no errors) and the format check for `website` and `e2e` pass. The repo has no `pnpm check` script. `pnpm format:check` fails on 11 roadmap brief files outside this node's scope, including this node's own `brief.md`.

## Deviations

- **Classic render worker.** It runs from a blob in an opaque frame, so it is not a module worker.
- **No service worker.** The brief offered a separate origin or a sandbox. The sandbox works, but not with the service worker, so the document carries its chunks.
- **Panel rows are chunk reports.** The panel no longer reads Resource Timing for the REPL, so it lists no loader or font row and sizes are code bytes.

## Stubs left

- Fonts in the frame. Embedding them as data URLs, or sending CORS headers for `/fonts/`, would restore them.

## Gotchas

- A navigation of a frame without an origin does not go through a service worker, so the site's fallback page loaded instead of the run.
- `toHaveText` fails on the hidden `<title>` of a frame. Use `toHaveJSProperty('textContent', ...)`.
- Each e2e website spec starts `vite preview` on its own port: `E2E_WEBSITE_PORT` (4590) and `E2E_WEBSITE_REPL_PORT` (4591).

## Proposed learnings

- None.

## Verification

- Playwright (chromium) against `vite preview` of `website/dist/client`, in the e2e specs above (8 tests, run twice) and a hand mutation check of the run frame.

## Size

- Estimated M, actual M.
