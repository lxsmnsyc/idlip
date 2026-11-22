---
id: docs-live
title: Run and edit code samples in place on the docs pages and the landing page
status: todo
priority: should
type: feature
story:
early: false
outline: false
milestone: 0.1
target:
ship: auto
land: auto
from:
size: L
spike: false
hypothesis:
verify: pnpm --filter idlip build && pnpm --filter website build && pnpm --filter website test && pnpm --filter website check:samples
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-22
spent:
owns:
  - website/src/repl/**
  - website/src/live/**
  - website/src/client/live.ts
  - website/src/markdown.ts
  - website/docs/**
  - website/test/live*
  - website/test/repl*
shared:
  - website/src/site.ts
  - website/src/styles.css
  - website/src/landing/index.ts
  - website/src/layout.ts
  - website/test/landing.test.ts
  - website/vite.config.ts
  - website/package.json
reserves: []
provides: []
depends_on:
  - on: landing-trim
    kind: hard
    why: both edit the landing sample and styles.css
  - on: website-repl
    kind: hard
    why: reuses the REPL's compile, render and frame pipeline
  - on: website-landing
    kind: hard
    why: shares styles.css and the landing sample, which this node makes live
---

# Run and edit code samples in place

Today a runnable docs sample shows an "Open in REPL" link (`website/src/markdown.ts`, `code-repl`). The reader has to leave the page to try the code. The user wants samples to run and be editable in the page, as brumate's docs do.

## Prior art: brumate

Read `/Users/alexis/Documents/GitHub/brumate/website/src/components/LiveSample.brm`, `src/live/run.ts` and the `brm live` handling in `plugins/markdown.ts`. Brumate's model:

- A fence such as ` ```brm live ` (several adjacent `live` fences are the files of one sample) renders as a live sample instead of a static block.
- An editor in place: a textarea over a highlighted backdrop, file tabs when there are several files.
- It runs when it scrolls into view, and runs again 400 ms after typing stops. Only the latest run writes its result.
- Result and Compiled tabs, a running state, an error panel and compiler warnings.

## What to build

- **Markup.** A `tsx live` fence (and `tsx live name.tsx` for extra files) renders a live sample. The server-rendered HTML shows the highlighted code (works with no JS and for search and copy) plus a reserved result area. Decide which existing samples become live: every block that today gets a REPL link (`getSampleLink`) is the starting set. Fragments stay static.
- **Run.** Reuse the REPL pipeline in `website/src/repl/` (compile on the main thread, render in the Worker with its timeout, the frame loaded through the service worker). Prefer one small frame per sample, sized to its content, so samples on one page cannot collide on the document listener or `i-state`. Load the compiler and runtime only when the first sample comes into view, not on page load. Hold the result area at a fixed min height so nothing shifts.
- **Editor.** Textarea over the highlighted code (reuse `repl/editor.ts` and `repl/highlight.ts`), debounced rerun, Result and Compiled tabs (the Compiled tab can list the chunks with sizes, which shows resumability), running state inside the bar, error and timeout shown in place.
- **REPL link.** Remove "Open in REPL" as the main action. A quiet secondary icon button that opens the current (edited) code in the REPL is fine, for sharing.
- **Landing page.** Swap the static landing sample (`.landing-sample`, left by website-landing) for a live sample of the same code.
- **States** (ui-style): idle before view, loading, running, result, error, timeout, reduced motion, keyboard (Tab leaves the textarea: Esc then Tab, or document the trap), mobile width.
- Update `check:samples` so live samples are compiled and fail the build on errors.

## Acceptance

- On a docs page with a live sample, the reader edits the code and sees the result update without leaving the page. Two live samples on one page work independently.
- No compiler or runtime JS loads before a sample is near the viewport (check the network panel; note sizes in outcome.md).
- No "Open in REPL" text link remains on docs pages.
- Tests cover the fence parsing, the static fallback HTML, and the landing sample.
- Verify passes; `pnpm format` clean.
