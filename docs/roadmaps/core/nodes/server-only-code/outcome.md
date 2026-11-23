# Outcome: server-only-code

## Public API

No new option, export or compiler change. The plugin adds two build errors (also shown in the `vite dev` overlay when the chunk is first requested). Messages, with `<...>` for the parts that vary:

```
idlip: the client chunk <chunk> of <component module id> imports a Node.js module: <component> > <chunk> > <file> > ... > <specifier>. The browser cannot run it. Import it where the server renders and pass the result in as a prop.
```

```
idlip: the client chunk <chunk> of <component module id> reads import.meta.env.<KEY>, which the browser does not get: <component> > <chunk> > <file> > .... Only <prefix>*, MODE, DEV, PROD, SSR and BASE_URL reach the browser. Read it where the server renders and pass it in as a prop.
```

Example: `idlip: the client chunk handler=add of /src/app.tsx imports a Node.js module: /src/app.tsx > handler=add > /src/db.ts > node:fs.` A `<prefix>` is each entry of Vite's `envPrefix` (default `VITE_`). Only your own files are walked; `idlip` and `idlip/*`, `node_modules` files, virtual ids and non-scripts are skipped.

## Built

- `packages/idlip/src/vite/server-only.ts`: `scanModule`, `isBuiltIn`, `isPublicKey`, `checkServerOnly`, `readSource`.
- `plugin.ts`: `load` of a client-environment chunk calls `checkChunk`; `envPrefixes` read in `configResolved` (default `VITE_`). `vite/CLAUDE.md` has the rule.
- Docs: `website/docs/what-runs-where.md` (Guide, order 16).
- Tests: `packages/idlip/test/server-only/server-only.test.ts` (9: scan, helpers, handler/binding/derived const to `node:`, bare `path`, private key through an import, private key in a module-level binding, public and custom-prefix keys pass, server-render-only imports pass).
- Changeset `.changeset/server-only-guard.md` (`idlip`, minor).

## Acceptance

- `pnpm build`, `pnpm typecheck`, `pnpm lint` (0 errors, existing warnings), `pnpm format:check`: pass. `pnpm test`: 90 files, 974 passed, 35 skipped. `pnpm --filter e2e test`: 52 passed (loader budget test included, loader untouched). `pnpm --filter website build`: 32 pages.

## Deviations and gotchas

- `import.meta.env` directly in a handler or derived const is already a compile error (`hole-grammar`), so a private key reaches a chunk through a module-level binding or an imported module. Tests cover both.
- A dependency in `node_modules` that imports Node modules is not walked. A private key read through `process.env` is not checked.
- Dev is checked in `load`, not covered by a dev-server test; it shares the build code path.
