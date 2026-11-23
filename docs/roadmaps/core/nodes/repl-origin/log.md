# Log: repl-origin

- Prototype first: `sandbox="allow-scripts"` on the REPL frame, with the old service worker pipeline. The navigation of a sandboxed frame to the service worker's folder was not intercepted (a frame with an opaque origin is not given to a service worker), so the request went to the network and got the site's fallback page. Dropped the service worker.
- Next prototype: the frame document as `srcdoc`, with the loader and the chunks inside it. The frame makes blob URLs and an import map maps the run folder URLs to them. The loader's `import()` works through the map. Counter resumes and updates in Chromium.
- The page cannot read a frame without an origin, so every `contentDocument` use went: theme goes by message, height by the frame's bridge, and the network panel by chunk reports from the frame.
- The compiler refuses `parent` and `localStorage` as free names in a handler. The probe in the e2e test uses `window.parent`, `window.localStorage`, `window.top` and `document.cookie`, which the compiler allows.
- Mutation check: with the `sandbox` attribute removed, the same probe reads `parent.document.title` and the site's `localStorage`. With it, every read throws.
- Site web fonts fail in the frame (CORS from origin `null`). Left as is, see the outcome.
