---
id: component-styles
title: Stylesheets imported by components reach the page
status: todo
priority: must
type: feature
story:
early: false
outline: false
milestone: '0.1'
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm check && pnpm --filter website build
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-23
spent:
owns:
  - packages/idlip/src/server/styles.ts
  - packages/idlip/test/styles/**
  - examples/todo/src/*.css
  - website/docs/styles.md
shared:
  - packages/idlip/src/vite/**
  - packages/idlip/src/server/**
  - packages/idlip/src/compiler/**
  - examples/**
  - e2e/**
  - website/docs/**
reserves: []
provides: []
depends_on: []
---

# Stylesheets imported by components reach the page

Today `import './todo.css'` in a component builds with exit 0 and the CSS appears nowhere: not in the client assets, not in Nitro's output, no `<link>`, no warning. The compiler splits the component into chunks and the side-effect import does not survive. Found 2026-11-23 by adding a stylesheet to `examples/todo`.

Decisions approved by the user (2026-11-23):

1. Vite CSS imports are the styling story: plain `import './x.css'` (global) and CSS Modules (`import styles from './x.module.css'`, class names scoped to the file). No `<style>` blocks or scoping compiler of idlip's own.
2. The server links every stylesheet reachable from the root component's imports, including children that only render after a click. Splitting per route waits for `routing`.
3. Not in this node: brumate's `${}` values as CSS custom properties. `style={{ '--size': size }}` covers it.

Read first: `packages/idlip/src/vite/plugin.ts` and `chunks.ts` (how the chunk map and `loader` key reach the server), `server/response.ts` (head order, nonce, CSP), brumate `docs/styles.md` for how stylesheets travel with their component, and Vite's `ssrManifest` / `build.manifest` `css` fields.

## Do

- Keep a component module's CSS imports through compilation: the CSS stays in the module graph of the server build and the client build, and Vite emits it as assets.
- Record, per component module, the stylesheet URLs its import graph reaches, in the build data the server already reads (next to the chunk map). The root's set is the union over every component it can render.
- `renderToResponse` and the streaming writer put `<link rel="stylesheet">` for that set in `<head>`, before the preload links, with the nonce. `csp: true` adds `style-src 'self'` (plus the nonce) unless the user's `extend` sets it.
- CSS Modules: the class-name object is a plain value. It works in the view, in holes and in handler chunks. Confirm the chunk that reads it gets the same names as the server render.
- Dev: CSS hot reload through Vite. In dev the server links what Vite serves (or Vite's injected styles, if that is how dev works best; say which in the outcome). No flash of unstyled content on the first load in dev.
- A component in an `<i-c>` child, a `<For>` body and a block body that only renders after a click still has its CSS linked on first load.
- `idlip/testing` `mount`: stylesheets load or are ignored; say which.
- `examples/todo` gets a stylesheet and one CSS Module. Docs page `website/docs/styles.md`, linked from the docs index.

## Acceptance

- An e2e test on the todo example checks a computed style from a plain stylesheet and from a CSS Module, after a production build served by Nitro and in dev.
- A test shows a stylesheet imported only by a child that renders after a click is linked on first load.
- The loader stays under 4096 B gzip, and its size does not change.
- `pnpm check` passes and `pnpm --filter website build` passes.
