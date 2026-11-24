---
id: site-components
title: Render the docs pages from idlip components
status: todo
priority: should
type: refactor
story:
early: false
outline: false
milestone: '0.2'
target:
ship: pr
land: auto
from:
size: L
spike: false
hypothesis:
verify: pnpm --filter idlip build && pnpm --filter website build && pnpm --filter website test && pnpm --filter website check:samples
exclusive: []
fulfilled_by:
gate: true
added: 2026-11-24
spent:
owns:
  - website/src/layout.ts
  - website/src/site.ts
  - website/src/markdown.ts
  - website/src/pages/**
  - website/scripts/build.ts
  - website/vite.config.ts
  - website/package.json
  - website/README.md
  - website/test/**
shared:
  - website/src/repl/page.ts
  - website/src/landing/index.ts
reserves: []
provides: []
depends_on: []
---

# Render the docs pages from idlip components

## Goal

The website builds its pages as strings in `website/src/layout.ts` and `site.ts` (`renderHead`, `renderHeader`, `renderSidebar`, `renderPage`). Replace that with idlip TSX components: a document component (`<html>`, `<head>`, `<body>`) with the header, sidebar, contents, pager and footer, rendered at build time with `idlip/server`. The docs site then runs on the framework it documents. The output pages look and behave the same.

## Context

- Why the site was static: `nodes/website-scaffold/brief.md`, "It does not run on idlip, so the docs do not wait for the runtime nodes." The runtime has since shipped, so the reason no longer holds.
- Whole documents render from a component: `nodes/entry-setup/outcome.md`. `renderToStream` / `streamParts` write the doctype, listener, loader and state script. Read the stream to a string at build time.
- Markdown stays: markdown-it and the `@twinkleplop` highlighters make the body HTML. Pass it into the component with `html={trusted(body)}` (`website/docs/views.md:91`, `svg-and-html.md:86`).
- The pages need no client code from idlip yet. If a static document component still ships a loader or state script, note it in `outcome.md` and find whether the render can omit them for a page with no handlers. Do not add a server option for it without asking.
- Compile the components at build time through `idlip/vite` (for example `vite build --ssr` for a pages entry, or Vite's module runner), not with a hand-written compile step.
- `website/src/repl/page.ts` and `website/src/landing/index.ts` call `renderHead`, `renderHeader` and `renderFooter`. Keep those pages working: either keep thin wrappers until `landing-components`, or move the REPL page shell into a component here.
- `website/src/repl/frame-document.ts` is the REPL's sandbox frame, not a site page. Leave it.

## Acceptance

- [ ] No page HTML is built by string concatenation in `layout.ts` or `site.ts`. Every docs page renders from one idlip document component under `website/src/pages/`.
- [ ] `dist/client` has the same pages and URLs as before (compare the file list), and a diff of a few pages shows only expected changes (attribute order, whitespace, idlip markers). List any visible change in `outcome.md`.
- [ ] Search, the REPL link, live samples and dark mode work in `pnpm --filter website preview`.
- [ ] `verify` passes, and `pnpm lint && pnpm format:check && pnpm typecheck` pass.
- [ ] `website/README.md` says the site renders with idlip, and drops "The site does not run on idlip".

## Sizing

L: replaces the page shell of a whole package and the build step, and runs into gaps in idlip's static use (loader on pages with no handlers, build-time compile). Files and patterns are known.

## Notes for the worker

- Gate: before writing the pages, show the user the document component's props and the build call (how `scripts/build.ts` renders one page). Stop and wait for approval. User rule: public setup surfaces are reviewed before they land.
- An idlip bug or missing feature found here is its own fix node on `packages/idlip`, not a workaround in the site.
- The website build is not in CI. Run `pnpm --filter idlip build` first, then the website build and tests locally.
