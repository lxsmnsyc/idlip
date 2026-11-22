---
id: multi-component-files
title: Allow several components in one .tsx file
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
verify: pnpm --filter idlip build && pnpm --filter idlip test && pnpm --filter website build && pnpm --filter website check:samples
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-22
spent:
owns:
  - packages/idlip/src/compiler/**
  - packages/idlip/src/vite/**
  - packages/idlip/test/compiler/**
  - packages/idlip/test/vite/**
  - packages/idlip/test/fixtures/**
shared:
  - packages/idlip/src/server/**
  - packages/idlip/src/client/**
  - website/docs/**
  - docs/roadmaps/core/contracts/compiled-format.change-request.md
reserves: []
provides: []
depends_on:
  - on: plain-tsx
    kind: hard
    why: builds on the plain .tsx module rules and the renamed fixtures
---

# Several components in one file

User decision (2026-11-22): open up support for multiple components in one file. Today a module has one function component, its default export (`website/docs/components.md`: "an idlip module is a file whose default export is a function component").

## Do

- Every exported function component in a `.tsx` file is a component: the default export and named exports (`export function Counter()`). A non-exported function component used only inside the file is also a component when the view renders it (`<Row />`), so a file can hold a parent and its private children.
- Imports: `import { Counter } from './widgets.tsx'` and the default import both work for rendering a child, with the same nesting behavior as today's cross-file children (own model, own chunks, `view` chunk when a parent adds it in the browser).
- Chunk and manifest naming: each component needs its own namespace. Keep the default export's names as they are today (`todo.handler.toggle.js`); a named component adds its name (`widgets.Counter.handler.increment.js`, or another stable, unique, readable form you justify in outcome.md). Manifests and server modules must address each component; check the compiled-format contract (`docs/roadmaps/core/contracts/compiled-format.md`) and write a change request instead of editing it.
- Diagnostics: two components with the same name, a component that is not a function declaration or arrow, and anything the old one-component rule guarded.
- Docs: components.md and nesting.md show a two-component file.

## Acceptance

- A fixture with a default and two named components (one private) renders on the server, resumes, and a click inside each loads only its own chunks.
- Existing fixtures' chunk names are unchanged.
- Verify passes.
