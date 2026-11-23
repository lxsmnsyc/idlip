---
id: server-only-code
title: Keep server-only code out of client chunks
status: todo
priority: should
type: feature
story:
early: false
outline: false
milestone: '0.2'
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter idlip build && pnpm --filter idlip test
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-23
spent:
owns:
  - packages/idlip/src/vite/**
  - packages/idlip/test/vite/**
shared:
  - packages/idlip/src/compiler/**
  - website/docs/**
reserves: []
provides: []
depends_on: []
---

# Keep server-only code out of client chunks

Nothing stops a component from importing a database client or reading a secret, and code a handler or binding reaches can end up in a client chunk.

Read first: brumate `website/docs/what-runs-where.md` and `environment.md`, idlip's chunk splitting (`packages/idlip/src/compiler/`, `vite/plugin.ts`), and how Vite and other frameworks mark server-only modules (`.server.ts` suffix, `server-only` package, `import.meta.env.SSR`).

## Do
- A rule for what may reach the client: a module named `*.server.ts` (or the convention brumate uses) and any `node:` import are server-only; a client chunk that would import one fails the build with an error that names the chain (component, handler or binding, import).
- Environment values: only `import.meta.env` keys with a public prefix reach client chunks; others fail the build when a client chunk reads them.
- Props and the model are the way data crosses: document it.

## Acceptance
- Build errors with the import chain for both cases; tests cover a handler, a binding and a derived const that reach server-only code.
- A docs page: what runs where.
