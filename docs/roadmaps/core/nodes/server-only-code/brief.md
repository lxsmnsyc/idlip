---
id: server-only-code
title: Fail the build when server-only code reaches a client chunk
status: done
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
verify: pnpm --filter idlip build && pnpm --filter idlip test && pnpm --filter e2e test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-23
spent: 322000
owns:
  - packages/idlip/src/vite/server-only.ts
  - packages/idlip/test/server-only/**
  - website/docs/what-runs-where.md
shared:
  - packages/idlip/src/vite/**
  - packages/idlip/src/compiler/**
  - website/docs/**
reserves: []
provides: []
depends_on: []
---

# Fail the build when server-only code reaches a client chunk

Nothing stops a handler or binding from importing a database client, a `node:` module or a private env key, and the code then ships in a client chunk.

Decided with the user (2026-11-23): `'use server'` will be the only server-only marker, and it comes with server functions in `server-data` (0.2). No `.server.ts` naming convention. This node is the guard that catches mistakes `'use server'` cannot, narrowed to two rules. It ships in 0.1 because adding build errors after the release would break apps that already shipped.

Read first: brumate `website/docs/what-runs-where.md` and `environment.md`, the chunk splitting in `packages/idlip/src/compiler/` and `vite/plugin.ts`, and Vite's `envPrefix` (`VITE_` by default).

## Do

- A client chunk (handler, binding, list, view, helpers) whose import graph reaches a `node:` import, or a bare Node built-in (`fs`, `path`, `crypto` and the rest of `builtinModules`), fails the build. The error names the chain: component, handler or binding, then each import down to the built-in.
- A client chunk that reads an `import.meta.env` key without the public prefix (Vite's `envPrefix`) fails the build with the key and the chain. `MODE`, `DEV`, `PROD`, `SSR` and `BASE_URL` are allowed.
- Code that only the server render reaches (the component body outside handlers and bindings, the entry) is not checked.
- In dev, the same checks run when a chunk is first requested, and the error shows in Vite's overlay.
- A docs page `website/docs/what-runs-where.md`: what runs on the server, what runs in the browser, that props and the model are the way data crosses, and that `'use server'` comes with server functions.

## Acceptance

- Tests: a handler, a binding and a derived const that reach a `node:` import, each failing with the chain; the same for a private env key; a server-only import used only in the server render passes.
- `pnpm test`, the e2e tests and the website build pass. The loader is unchanged.

Landed 2026-11-23 on main (487d030..45528e8): the build fails when a client chunk keeps a Node built-in (read from the bundle, so npm packages and CommonJS count) or a private env key; vite dev warns. Reviewed, two fix rounds.
