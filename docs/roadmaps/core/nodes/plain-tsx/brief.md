---
id: plain-tsx
title: Compile plain .tsx files, drop the .idlip.tsx extension
status: todo
priority: must
type: refactor
story:
early: false
outline: false
milestone: 0.1
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter idlip build && pnpm --filter idlip test && pnpm --filter website build && pnpm --filter website test && pnpm --filter website check:samples
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-22
spent:
owns:
  - packages/idlip/src/vite/**
  - packages/idlip/src/compiler/index.ts
  - packages/idlip/test/vite/**
  - examples/**
  - benchmarks/idlip/**
  - e2e/**
shared:
  - packages/idlip/src/compiler/view/analyze/**
  - packages/idlip/test/**
  - website/docs/**
  - website/src/repl/**
  - website/src/landing/**
  - website/src/demo/**
  - docs/proposals/**
reserves: []
provides: []
depends_on:
  - on: website-landing
    kind: hard
    why: the landing sample and demo name the files this node renames
---

# Compile plain .tsx files

User decision (2026-11-22): drop the `.idlip.tsx` extension. An idlip project only uses TSX for idlip components, so a special extension is redundant.

## Do

- The Vite plugin compiles every `.tsx` file matched by its `include` globs. Default `src/**/*.tsx`. Today: `MODULE_FILE = /\.idlip\.tsx$/` and `src/**/*.idlip.tsx` in `vite/plugin.ts`.
- An imported component comes from any `.tsx` module the plugin compiles. Today `analyze.ts` requires `/\.idlip(\.tsx)?$/` on the import source (around lines 1602 and 1633) and errors otherwise. Keep a clear error for an import from a file the plugin does not compile (outside `include`), with the diagnostic naming the `include` option.
- Chunk file names: today they start with the file base (`todo.handler.toggle.js` from `todo.idlip.tsx`). With `todo.tsx` the names must stay the same shape. Make sure two files `a/todo.tsx` and `b/todo.tsx` still get distinct chunk names (check what happens today with `.idlip.tsx` and keep that behavior).
- Rename every `*.idlip.tsx` in the repo (28 files: examples, benchmarks/idlip, e2e fixtures, test fixtures, expected outputs) and update imports, docs (`website/docs/**`, `components.md` defines "an idlip module"), the REPL's default file names (`website/src/repl/**`, e.g. `app.idlip.tsx`, `counter.idlip.tsx`), the landing sample and demo, and proposals where they show file names.
- `.ts` files stay plain modules (helpers, entry files); not compiled as components.
- Changeset not needed (unreleased 0.0.0-stage), but note the change in the getting-started page.

## Acceptance

- No `idlip.tsx` string left outside `docs/roadmaps/**` (`git grep`).
- A `.tsx` file outside `include` imported as a component gives a diagnostic that names the option.
- Chunk names for the todo example are unchanged except for the extension (compare the e2e first-click chunk names).
- Verify passes; e2e todo spec passes (`pnpm -C e2e test` if runnable locally).
