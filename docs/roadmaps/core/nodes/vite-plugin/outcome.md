# Outcome: vite-plugin

## Built

- `idlip/vite` exports `idlip(options)` and the type `IdlipOptions` (`packages/idlip/src/vite/plugin.ts`, re-exported from `src/vite/index.ts`). Options:
  - `modules`: globs of idlip modules relative to the root. Default `src/**/*.idlip.tsx`.
  - `entry`: the server entry, such as `/src/entry-server.ts`. It exports `render(url)`, which returns the page HTML. `vite dev` renders pages with it, and it is the ssr build input when the config sets none.
  - `client`: the client build input, the loader. Default `idlip/client`.
  - `compile`: the compiler. Default: `compile` from `idlip/compiler`. Until `compile-integration` exports it, the plugin throws an error that says to pass `compile`.
- What the plugin does:
  - `enforce: 'pre'`: `compile()` gets the `.tsx` source, not the output of Vite's JSX transform, in both environments.
  - `config`: sets `builder: {}` so `vite build` builds the app. Defaults the output folders to `<outDir>/client` and `<outDir>/server`, where `outDir` is `build.outDir` or `dist`, so the ssr build cannot empty the client output. Sets the client input to `client` and the ssr input to `entry`. An environment `outDir` or input in the user config wins.
  - `buildApp`: builds client, then ssr, and skips environments already built.
  - Client `buildStart`: globs the modules, compiles each, and calls `emitFile({ type: 'chunk', id, name, preserveSignature: 'exports-only' })` per chunk of the manifest. The id is `getChunkId(<absolute file>, chunk)`. The name is `<base name>.<getChunkFile(chunk) without .js>`, such as `todo.binding.todos._.done`.
  - `load`: serves a chunk id (`?idlip-<chunk>&lang.js`) with the compiled client module, as `moduleType: 'js'`. An unknown chunk is an error.
  - `transform` of `*.idlip.tsx`: in server environments it returns the compiled server module. In a build it replaces the value of `export const chunks` with the built URLs, found by parsing with oxc-parser (`replaceChunkUrls` in `src/vite/chunks.ts`). In dev the ids are the URLs, so the code is unchanged unless `base` is not `/`. In the client environment it is an error, since the client loads chunks by URL.
  - Client `generateBundle`: maps each chunk id to `${base}${fileName}`. Ids use the root-relative module id, per contract v8. The ssr build reads the map from memory (`sharedDuringBuild: true`). `writeBundle` writes it to `<outDir>/.idlip/chunks.json`, outside the served client folder, for a server build in another process.
  - Client `generateBundle` also checks that every static import of an idlip chunk is in the static graph of the loader entry. Otherwise the build fails and names the chunk and the import, since a click would load one more file. An external import counts as loaded when the loader imports it too.
  - Diagnostics: warnings go to `this.warn`. Errors fail the build with `<module>:<line>:<column> <rule>: <message>`.
  - `hotUpdate` in the client environment for a `*.idlip.tsx` file: invalidates the file's modules and sends `full-reload`. The ssr environment keeps Vite's default handling.
  - `configureServer`, when `entry` is set: a middleware for `GET` requests that accept `text/html`. It imports the entry through the ssr runner, calls `render(url)`, runs `transformIndexHtml` and responds.
- `src/vite/chunks.ts`: `parseChunkId`, `listChunks(manifest)`, `isChunkUrls`, `replaceChunkUrls(code, urls)`.
- Tests in `packages/idlip/test/vite/`: `vite.test.ts` (14 tests), `app.ts` (writes the fixture app to a temp folder with a loader that imports nothing, for the check; holds the stub compiler `compileFixture`, the checked compiler that throws unless its input equals the file on disk, and the test Vite config), `client-stub.ts` (stands in for `idlip/client` in the client build).

Acceptance:

- [x] `vite build` of the todo fixture app emits the chunk set the manifest lists. The test builds the counter and the todo. It checks four things. `chunks.json` holds exactly the chunk ids of both manifests. Each URL is a file under `assets/` with the exports of the fixture chunk. The only other client files are the loader and the files it imports statically. The built server renders the todo with the built URLs in its state script.
- [x] A test starts `vite dev` and fetches server-rendered HTML for the fixture. The page contains the todo's `expected/page.html`, and the counter's at `/counter`. A chunk id fetched from the same server returns `text/javascript` with the chunk's exports.
- [x] Fast check passes: `pnpm --filter idlip test`, 141 passed.

## Deviations

- No files outside the owned paths and this folder.
- The chunk URL file is `.idlip/chunks.json` and holds a `ChunkUrls` map, not the spike's per-module `.idlip/manifest.json`. The contract defines `ChunkUrls`, so the file holds that.
- The client input defaults to `idlip/client`, which `resume-loader` makes the loader.

## Stubs left

- `compile`: tests pass `compileFixture` from `test/vite/app.ts`, which returns the golden fixture output. Once `compile-integration` exports `compile` from `src/compiler/index.ts`, the default works with no change here. `getDefaultCompile` can then become a plain import.
- The fixture app's server entry renders with `createContext` from `test/fixtures/reference.ts`. The test config aliases `idlip/server` to `reference.ts` and `idlip/client` to `test/vite/client-stub.ts`. `ssr-render`, `patch-bindings` and `resume-loader` replace them, and `example-todo` needs no aliases.

## Gotchas

- Chunks import `idlip/client`, so it must be in the loader's static graph, or the build fails. `resume-loader` makes `src/client/index.ts` the loader: boot code plus the helper exports. A custom `client` input must `export * from 'idlip/client'`. A loader that imports only some names from a multi-file `idlip/client`, or only has a bare side-effect import, fails the check.
- The tests use the `idlip/client` stub itself as the client input, the default shape.
- macOS temp folders are links (`/var` to `/private/var`). Vite keys modules by the real path, so tests use `realpathSync` on the temp root.
- The dev middleware answers only requests whose `Accept` header includes `text/html`. `import()` of a chunk sends `*/*`, so Vite serves it.
- Vite names the server output `.mjs` when the root has no `package.json` with `"type": "module"`.
- `pnpm build` warns that `node:fs` and `node:path` are unresolved in `src/vite`, since tsdown runs with `platform: 'neutral'`. It keeps them external and the output works. The coordinator adds `/^node:/` to `deps.neverBundle` in `tsdown.config.ts`.
- A server build in a separate process reads `<outDir>/.idlip/chunks.json`. Without a client build first it fails with "build the client before the server".

## Proposed learnings

- The plugin rewrites the server module's `chunks` export by parsing, not by string replacement | the compiler may change quote style or formatting | packages/idlip/src/vite | yes, `replaceChunkUrls` has a test
- Test Vite builds in a temp root with `ssr.noExternal: true` | the temp root has no node_modules for externals | packages/idlip/test/vite | no

## Verification

- `pnpm --filter idlip exec vitest run test/vite` (the brief's verify): 14 passed.
- With `enforce: 'pre'` removed, the checked compiler fails 3 tests, in build and dev.
- `pnpm --filter idlip test`: 141 passed.
- `pnpm format:check`: passes.
- `pnpm typecheck`: passes.
- `./node_modules/.bin/oxlint --type-aware`: no errors. Four warnings, all in `compile-view-analyze` files from the batch.
- `pnpm --filter idlip build`: passes, with the `node:` warnings above.

## Size

- Estimated L, actual M. The spike settled the scheme, and the golden fixtures made the stub compiler short.
