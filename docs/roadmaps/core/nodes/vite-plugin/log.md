# Log: vite-plugin

- Started from batch/core b434468. No earlier work on `src/vite`: the subpath exported nothing.
- `compile()` and `render()` are not built. The plugin takes `compile` as an option and falls back to `compile` from `idlip/compiler` when that export exists. Tests pass a stub that returns the golden fixture output.
- The fixture app is written to a temp folder per test: fixture sources under `src/`, a client entry, and a server entry that renders with the reference state writer from `test/fixtures/reference.ts`.
- Vite names the server build output `entry-server.mjs` when the root has no package.json with `type: module`.
- The server build keeps seroval external by default, and the temp root has no node_modules, so the test config sets `ssr.noExternal: true`.
- tsdown with `platform: 'neutral'` warns that it cannot resolve `node:fs` and `node:path` in `src/vite`, and leaves them external. The output works. A fix belongs in `tsdown.config.ts`, which this node does not own.
- Review fixes: `enforce: 'pre'`, a loader static graph check in `generateBundle`, the client input defaults to `idlip/client` (option `client`), output folders under `build.outDir`, `chunks.json` moved to `<outDir>/.idlip/`. Tests: a checked compiler in build and dev, the loader check, `build.outDir`, `hotUpdate`.
- Round 2: Rolldown keeps every helper a chunk imports, so no global is needed. The tests use the `idlip/client` stub as the client input. `resume-loader` makes `src/client/index.ts` the loader, and a custom `client` must `export * from 'idlip/client'`. An external import the loader also imports is no longer reported.
