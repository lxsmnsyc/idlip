# Outcome: spike-chunk-split

## Built

A prototype Vite plugin in `docs/roadmaps/core/nodes/spike-chunk-split/proto/`:

- `plugin.ts`: `idlip({ helpers })`, the prototype of `idlip/vite`.
- `stub-compiler.ts`: finds handlers with oxc-parser, takes binding groups from a hand-written table for the todo fixture.
- `src/todo.idlip.tsx`: the todo example of proposal 0002, unchanged apart from a header comment.
- `src/entry-client.ts`: a loader that imports no app module, only `import(url)`.
- `src/entry-server.ts`: renders the chunk URLs of the todo module from `virtual:idlip/manifest`.
- `vite.config.ts`: client and ssr environments, `buildApp` builds client then ssr.
- `dev.ts`: a dev server in middleware mode with no port. It renders, requests each chunk, edits the module twice and logs the hot updates, then restores the file and closes.

Answer to the brief's question, as measured:

### Virtual module id scheme

A chunk id is the source file path with a query:

- `<abs>/todo.idlip.tsx?idlip-handler=<name>&lang.tsx`, one per handler.
- `<abs>/todo.idlip.tsx?idlip-binding=<path>&lang.tsx`, one per binding group, keyed by model path, such as `todos.*.done`.
- The source file itself, with no query, is the server renderer (`transform` replaces it).
- `virtual:idlip/manifest` (resolved to `\0virtual:idlip/manifest`) exports `chunks`: `{ [moduleId]: { handlers: { name: url }, bindings: { path: url } } }`. `moduleId` is the path relative to the root, such as `src/todo.idlip.tsx`.

Why a query on the real path and not a `\0` id:

- Vite serves it in dev as `/src/todo.idlip.tsx?idlip-handler=toggle&lang.tsx` with no extra middleware, and relative imports in the chunk (`./api`) resolve against the source file.
- Vite's module graph keys file lookups by path without the query, so `hotUpdate` for the source file receives every chunk module of that file.
- The ids are also keys in Vite's own `.vite/manifest.json` (`build.manifest: true`), so that file could replace the plugin's manifest.

The id must end in `&lang.tsx` (or `&lang.js` once the compiler emits `.js` code). Without it, `?idlip-binding=save.state` fails with `Failed to detect the lang`, because Vite reads the loader from the end of the id. `moduleType` in the `load` result does not override this.

### How chunks become files in the build

The client never imports a `.idlip.tsx` file: the loader takes URLs from the page. So no import graph reaches the chunks. In `buildStart` of the client environment, the plugin globs `src/**/*.idlip.tsx` and calls `this.emitFile({ type: 'chunk', id, name: 'todo.toggle', preserveSignature: 'exports-only' })` for each chunk id. In `generateBundle` it maps each reference to its file with `this.getFileName(ref)`.

Rolldown does not merge tiny chunks here. Each emitted chunk is an entry and stays one file, the smallest at 376 B. `experimental.chunkOptimization: false` gave identical output and hashes, so no option is needed to stop merging. Shared code is the issue instead (see Gotchas).

### How the manifest reaches the server renderer

- Dev: the ssr environment loads `virtual:idlip/manifest`, which the plugin builds by compiling every scanned module and writing `${base}${moduleId}?idlip-...&lang.tsx` URLs. No build step.
- Build: the client build's `generateBundle` stores the manifest in a plugin closure and emits `dist/client/.idlip/manifest.json`. The plugin sets `sharedDuringBuild: true`, so with `vite build --app` the ssr build reads the closure. A server build in another process reads the JSON file from the client `outDir`. The manifest is inlined into `dist/server/entry-server.js` as a constant. This is brumate's `builtHints` plus `hints.json` pattern.
- The renderer writes the URLs into the page. `node -e "import('./dist/server/entry-server.js').then(m=>console.log(m.render()))"` printed `/assets/todo.toggle-BrMxBggR.js` and the rest.

### How HMR invalidates chunks

- In the client environment, `hotUpdate({ file, modules })` for a `.idlip.tsx` file receives the chunk modules of that file. `dev.ts` loads all 9 first, so the claim that it lists only loaded chunks is untested.
- In the ssr environment it receives the source module.
- The plugin invalidates those modules and `\0virtual:idlip/manifest`, returns `[]`, and sends `full-reload` to the client.
- It also recompiles and diffs chunk sources. Editing only `toggle` showed `changed=[handlers:toggle]`. A later fine-grained HMR could send a custom event with only the changed chunk URLs. A changed binding chunk still needs the server's DOM for the new view, so a full reload stays the safe default.
- Editing the helper `countLeft` marked all 9 chunks changed. This second edit starts from the original source, so it also undoes the `toggle` edit, and `toggle` would differ either way. The rest changed because the stub copies every helper into every chunk. A compiler that copies only the helpers a chunk reaches would change only `todos` and `todos.*.done`.

### Chunk count for the todo fixture

9 client chunks: 4 handlers (`setDraft`, `toggle`, `add`, `persist`) and 5 binding groups (`draft`, `save.state`, `todos`, `todos.*.done`, `todos.*.text`). Plus `runtime` (292 B, shared with the loader entry, loaded at boot) and the loader entry (126 B).

Only two things here are measured: the handler count (4, found by oxc-parser) and that one emitted chunk becomes one file. The 5 binding groups come from the hand-written `FIXTURE_BINDINGS` table in `proto/stub-compiler.ts`. Putting the async segments of `add` and `persist` in their handler's chunk is the stub's choice. Read the total of 9 as depending on `spike-view-analysis`.

A first click on a checkbox loads `todo.toggle` (no imports) and `todo.todos._.done` (imports `runtime`, already loaded). That is 2 requests, which meets the GOAL's network count, as long as helpers are copied into chunks. It also relies on the loader importing `runtime` (`src/entry-client.ts`), so `runtime` is loaded at boot. A loader that does not import the runtime would add a third request.

## Result

Spike: answered. No hypothesis threshold in the brief.

- numbers (build, `helpers: 'inline'`): chunks of 376, 403, 421, 427, 476, 491, 531, 641 and 773 B, unminified. Client build 25 ms, ssr build 4 ms.
- `helpers: 'import'`: one more shared chunk of 182 B, imported by all 9. First click: 3 requests.
- `helpers: 'import'` with `experimentalInlineCommonChunks: { maxSize: 1024 }` and `preserveEntrySignatures: false`, which the option requires: chunks grow to 1303-2001 B, a 1205 B `rolldown-runtime` chunk appears, and `runtime.ts` is copied into each chunk. Rejected.
- reproduce: in `proto/`, `pnpm install --ignore-workspace`, then `npx vite build --app`, `IDLIP_HELPERS=import npx vite build --app`, `IDLIP_HELPERS=import IDLIP_CHUNK_OPT=off npx vite build --app`, `IDLIP_HELPERS=import IDLIP_INLINE_COMMON=1024 npx vite build --app`, `node dev.ts`. Vite 8.3.4, Rolldown 1.2.19, oxc-parser 0.154.0, Node 26.12.1, macOS arm64.

## Deviations

- The prototype files carry a file-level `oxlint-disable` comment: they have their own `node_modules` and no tsconfig, so the type-aware rules fail on every import. Without it, root `pnpm lint` would gain errors.
- `proto/pnpm-lock.yaml` is committed so the measurements reproduce. `proto/node_modules` and `proto/dist` are ignored by the root `.gitignore`.

## Stubs left

- `stub-compiler.ts`: binding groups come from a hand-written table (`FIXTURE_BINDINGS`), and handler chunks wrap the source handler over destructured locals. Replaced by the compiler nodes and `spike-view-analysis`.
- `src/runtime.ts` stands in for `idlip/client`, aliased as `idlip`.

## Gotchas

- End every chunk id with a real extension (`&lang.tsx` or `&lang.js`). Binding paths contain dots.
- A normal plugin's `transform` runs after Vite's TypeScript transform in dev and before it in build. Use `enforce: 'pre'`, or have the compiler emit plain `.js` code so order does not matter.
- Any module imported by two chunks becomes a shared chunk and costs one more request on a click. The compiler must copy module-level helpers into each chunk that uses them, not import them. Imports of real modules (such as `./api` in `persist`) stay in the chunk only while one chunk uses them. Code shared with the loader entry (the runtime) is loaded at boot and costs nothing on a click.
- Copy only what a chunk reads. The stub copies every derived `const`, so `toggle` keeps a dead `countLeft(todos)` call that Rolldown cannot drop. The compiler should include a derived value only in chunks that read it.
- The client build must know every `.idlip.tsx` file before it starts, since nothing imports them. The prototype globs `src/**`. A build that first runs the server and collects the modules it transformed would avoid the glob, but reverses brumate's order (client first).
- In dev the ssr environment never loads chunk ids, so its `hotUpdate` diff has no previous version. Track served chunks per environment.
- Chunk file names come from the `name` of `emitFile`. `*` in a binding path must be replaced (the prototype uses `_`: `todo.todos._.done-<hash>.js`).

## Proposed learnings

- Chunk ids are `<file>?idlip-<kind>=<name>&lang.<ext>` | Vite picks the loader from the end of the id, and binding paths contain dots | packages/idlip/src/vite | yes
- The compiler copies module-level helpers into each chunk | a shared helper module becomes an extra request per click | packages/idlip/src/compiler | yes, by counting chunk imports in a build test
- Emit chunks with `emitFile` in the client `buildStart` | no import reaches them | packages/idlip/src/vite | yes

## Verification

- `npx vite build --app` in `proto/`: passes, logs 11 chunks with their imports and modules, writes `dist/client/.idlip/manifest.json`.
- The fresh reviewer sent real HTTP GETs through `vite.middlewares` for the chunk URLs: each returned 200 with `text/javascript`.
- `node dev.ts` in `proto/`: passes, logs dev URLs, 9 chunk transforms and 4 `hotUpdate` lines, restores the source file.
- `pnpm exec oxlint --type-aware docs/roadmaps/core/nodes/spike-chunk-split`: exit 0.
- `pnpm exec oxfmt --check docs/roadmaps/core/nodes/spike-chunk-split`: passes.
- `pnpm typecheck`: passes.
- `pnpm --filter idlip test`: 7 passed (package untouched).
- Root `pnpm lint` fails on batch/core before this node, on `docs/roadmaps/core/debates/subscriptions/evidence/*.tsx`.

## Size

- Estimated M, actual M.
