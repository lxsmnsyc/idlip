# Outcome: server-only-code

## Public API

No new option, export or compiler change. The plugin adds two build errors in a build. `vite dev` logs the same message once per chunk and module as a warning through Vite's logger, followed by ` (vite dev warns only: a build fails when the code stays in the chunk.)`, and still serves the chunk. `<chain>` is names joined by `>`: the component, the chunk, each module down to the cause.

```
idlip: the client chunk <chunk> of <component module id> imports a Node.js module: <chain>. The browser cannot run it. Move the code that needs it to where the server renders and pass the result in as a prop, or use a package that runs in the browser.
```

```
idlip: the client chunk <chunk> of <component module id> reads import.meta.env.<KEY>, which is undefined in the browser: <chain>. Only <prefix>*, MODE, DEV, PROD, SSR and BASE_URL reach the browser. Read it where the server renders and pass the value in as a prop.
```

Example: `idlip: the client chunk handler=add of /src/app.tsx imports a Node.js module: /src/app.tsx > handler=add > /node_modules/fakepg/index.js > node:net.` `<prefix>` is each entry of Vite's `envPrefix` (default `VITE_`).

How it decides. Build: from the bundle. A chunk module `__vite-browser-external:*` that an importer reads is a Node.js module (this covers packages, `.cjs` `require`, `exports` conditions and polyfills, since Vite resolved them). A private `import.meta.env` read is rewritten to a pure marked call, and one left in a chunk after tree-shaking is the error. Dev: the AST walk of your own files, which cannot tree-shake, so it warns and does not fail.

## Built

- `packages/idlip/src/vite/server-only.ts`: `scanModule`, `isBuiltIn`, `isPublicKey`, `checkServerOnly`, `readSource`.
- `plugin.ts`: `load` of a client-environment chunk calls `checkChunk`; `envPrefixes` read in `configResolved` (default `VITE_`). `vite/CLAUDE.md` has the rule.
- Docs: `website/docs/what-runs-where.md` (Guide, order 16).
- Tests: `packages/idlip/test/server-only/server-only.test.ts` (17, plus the cases below: scan, helpers, handler/binding/derived const to `node:`, bare `path`, private key through an import, private key in a module-level binding, public and custom-prefix keys pass, server-render-only imports pass).
- Changeset `.changeset/server-only-guard.md` (`idlip`, minor).

## Acceptance

- `pnpm build`, `pnpm typecheck`, `pnpm lint` (0 errors, existing warnings), `pnpm format:check`: pass. `pnpm test`: 90 files, 974 passed, 35 skipped. `pnpm --filter e2e test`: 52 passed (loader budget test included, loader untouched). `pnpm --filter website build`: 32 pages.

## Deviations and gotchas

- `import.meta.env` directly in a handler or derived const is already a compile error (`hole-grammar`), so a private key reaches a chunk through a module-level binding or an imported module.
- Dev cannot tree-shake, so it follows imports of your own files and would flag a server-only import in a shared file that a build removes. By request of the coordinator it warns once and serves the chunk. It does not look into packages (a build does). A test drives dev with `createServer` and `transformRequest`, with a custom logger: one warning with the chain, the chunk is served, another chunk loads.
- Guard against a Rolldown change: the tests where the stub is read (a handler that calls `connect()` of `fakepg`, directly and through `db.ts`, and the `.cjs` `require('fs')`) fail if `isUnusedStub` mistakes a used stub for an unused one, and the tree-shaken `u.ts` test fails if it stops recognizing an unused one.
- In a production build Vite's stub is a CommonJS module that the bundler keeps even when its import is unused. An importer that binds it to a variable nothing reads counts as tree-shaken (`isUnusedStub`). This reads the bundler's generated code, so a new Rolldown naming scheme would need a look.
- A private env read in a package under `node_modules` is not marked.
- Not checked: `process.env`.
