---
id: website-polish
title: Give the website its own identity and a full landing page
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
verify: pnpm --filter website build && pnpm --filter website test && pnpm --filter website check:samples
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-22
spent:
owns:
  - website/src/**
  - website/DESIGN.md
  - website/public/**
  - website/test/**
  - website/vite.config.ts
  - website/package.json
  - website/directions/**
shared:
  - pnpm-lock.yaml
reserves: []
provides: []
depends_on:
  - on: website-directions
    kind: hard
    why: builds the direction the user picked
---

# Give the website its own identity and a full landing page

## Goal

Build the visual direction the user picked in `website-directions` across the whole site, and replace the bare landing page (a hero and one code block) with a full one.

## Landing page

In this order, after the hero:

1. **Resume diagram.** A stepped figure: the server renders HTML and the state script, the browser loads only the inline listener, a click fetches one update handler and patches only the bindings whose paths changed. It advances on scroll or with step buttons, and it is reversible. It is static with `prefers-reduced-motion`.
2. **Live demo.** The todo example running on the page, beside a panel that lists each request a click makes (URL, size). Server-render it at build time with idlip's own `render` and ship its chunks with the site, so the demo resumes from static HTML. If the static build cannot host it, say so in `outcome.md` and ship a recorded version instead. Do not silently drop it.
3. **Feature grid.** Short cards for MVU, resumability, TSX function components, subscriptions, effects, nesting, and the Vite plugin. Each card links to its guide page.
4. **Benchmark numbers.** Headline numbers against brumate, Qwik and Marko: JS loaded before the first click, cost of the first click, SSR throughput, rows operations. Read them at build time from one data file, `website/src/benchmarks.json`, with the run date and machine, so `perf-from-bench` and `docs-benchmarks` update the numbers without editing the layout. Link to the benchmarks page. Show the losses as well as the wins.
5. The todo sample, as now.

## Steps

- [ ] Replace the tokens in `styles.css` with the chosen direction's, self-host its fonts in `website/public/`, and restyle the header, sidebar, prose, code blocks, pager and table of contents to match.
- [ ] Rewrite `DESIGN.md` for the new identity. Drop the line saying the tokens come from brumate.
- [ ] Build the landing sections above.
- [ ] Leave room in the header for a search bar (`website-search`) and a REPL link (`website-repl`), and keep page scripts in `website/src/client.ts` split by feature, so those two nodes add files instead of editing the same lines.
- [ ] Delete `website/directions/` once the chosen tokens are in `styles.css`.
- [ ] Tests: the landing page has each section, every feature card links to an existing page, and the benchmark data file has the fields the page reads.

## Acceptance

- [ ] Light and dark, 1440 px and 390 px screenshots of the landing page and one docs page in `outcome.md`.
- [ ] The demo resumes: loading the page runs no view code, and a click loads one handler (shown in the panel).
- [ ] Every text color reaches 4.5:1 in both themes, every control has a focus ring, and with reduced motion every animation is off.
- [ ] The `verify` command, `pnpm lint` and `pnpm format:check` pass.

## Notes for the worker

- Follow the ui-style skill.
- Read the `website-directions` outcome and the user's pick in this brief's "Pick" section. The orchestrator fills that in before this node starts.
- Do not write `vercel.json`. The `website` node owns deploying.

## Pick

The user picked **Block** (`website/directions/block/`): rounded tiles, the tile that changed turns chartreuse, Bricolage Grotesque and Martian Mono. Build it in light and dark. Self-host both fonts as `woff2` and check their licenses and sources, since the directions README wrote the links from memory.

The user also said none of the three mocks visualizes resumability. The mocks' "resume diagram" is three tiles with byte counts, which tells the reader nothing about how it works. Replace it with a real visualization of the concept, the centerpiece of the landing page:

- **Two lanes side by side, same todo app: hydration and resumption.** Each lane shows server, network and browser, and a running count of JS bytes loaded and component code executed.
- **Steps the reader controls** (step buttons and scroll, reversible at any point):
  1. The server runs the component and writes HTML. Show the HTML with its binding markers and the `<script i-state>` holding the serialized model.
  2. The page arrives. Hydration downloads the whole app, re-runs every component and attaches listeners: its counters climb. Resumption loads the 962 B inline listener and runs nothing: its counters stay at zero, the state stays encoded.
  3. The reader clicks a checkbox. Resumption: the listener reads the event token from the DOM, fetches `handler.toggle.js`, decodes the state, runs the update.
  4. The update reports the changed path (`todos.1.done`). Resumption fetches only that binding chunk and patches only that one DOM node, which turns chartreuse. The rest of the tree stays dim to show it was never touched.
- Use real names and sizes from `website/docs/resuming.md` and the compiled todo example, read at build time where possible, not hand-typed.
- With `prefers-reduced-motion`, show the steps as a static sequence of panels.

This visualization matters more than any other landing section. Show its screenshots per step in `outcome.md`.
