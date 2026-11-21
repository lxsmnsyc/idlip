# Outcome: compiled-format

## Built

- `docs/roadmaps/core/nodes/compiled-format/compiled-format.proposed.md`: the frozen contract text, v8, `status: frozen`, no TBD. `contracts/compiled-format.change-request.md` asks the orchestrator to copy it over `contracts/compiled-format.md`.
- `packages/idlip/src/core/format.ts`: the shared types (`Manifest`, `DomMessage`, `PageState`, `StateRecord`, `Boot`, `QueuedEvent`, `ServerRender`, `Scope`, `NodeBinding`, `ListBinding`, `Update`, `Step`, `Task`, `ListChunk`, `Patch`, `DiffPaths`, `PatchList`, `OnBlock`, `RunTask`, `CompileResult` and the rest), plus `getChunkFile(chunk)` and `getChunkId(module, chunk)`.
- `packages/idlip/test/fixtures/counter/` and `test/fixtures/todo/`: source `.idlip.tsx`, `input.json` (module id such as `/src/todo.idlip.tsx`, source file name and props), and `expected/` with `server.js`, `manifest.json`, `page.html` and one file per client chunk. Counter: 3 handler chunks and 1 binding chunk. Todo: 4 handler chunks, 5 binding chunks and 1 item template chunk.
- `packages/idlip/test/fixtures/fixtures.test.ts`: 26 tests. Each file parses, the manifest has the right shape and equals the server module's export, the server module maps every chunk id to its URL, there is one file per chunk, chunk exports match the manifest and the covers rule, the server module renders `page.html`, rows from the item template match the page, every binding's node is in the page, the handler chunks compute the right models, the first toggle selects only `binding=todos.*.done` through a reference `diffPaths` and covers walk, a keyed reorder that moves `done` counts as a change, and a hole outside the rows patches after a reorder.
- `packages/idlip/test/fixtures/reference.ts`: reference `text`, `attr`, `on`, the state script writer, `diffPaths` (key and index pairing) and the covers walk.

Key decisions (details in the proposed contract):

- DOM: binding ids are view-ir hole ids, then one per event whose payload changes. Elements carry `i-a="<ids>"`. Text, conditions, lists and rows are comment pairs. Rows carry no key: the old model gives the row order.
- Events: `on:click='["toggle",["a1"]]'`, with top-level `["$event", ...]` placeholders and modifiers as a third item (`"prevent"`, `"key:Escape"`). Authoring is plain TypeScript: `e.preventDefault();` before the call, `if (e.key === 'Escape') { clear(); }`.
- State: `<script i-state>(self.$idlip||=[]).push(["click …",()=>(<seroval output>)])</script>`, holding `{ manifest, chunks, model, props }`. The client never imports seroval and decodes on the first event only.
- Chunk URLs: `manifest.module` is the root-relative Vite id, chunk ids are `<module>?idlip-<kind>=<name>&lang.js`, and `chunks` maps id to URL for the modules on the page. `vite-plugin` produces the map.
- Path diff: a `*` path under a keyed `<For>` changes when it differs by key or by index, so neither row bindings nor holes outside rows go stale after a reorder.
- Early events: an inline listener in `<head>` (`renderListener`) queues resolved messages. Budgets: listener 1024 B gzip, loader 4096 B gzip.
- Manifest: handlers, binding groups by path set, and lists. A group's chunk also patches the groups it covers, so the todo's first checkbox click loads `handler=toggle` and `binding=todos.*.done` only, which meets the GOAL's count even though `{left}` reads `todos`.

## Deviations

- The brief asks to set `status: frozen` in the contract. Workers may not edit contracts, so the text is in `compiled-format.proposed.md` and acceptance item 3 waits on the change request.
- Wrote three files outside the owned paths, as the worker rules require: `contracts/compiled-format.change-request.md`, `contracts/view-ir-v9.change-request.md` (event modifier authoring forms, rules `attr-reserved`, `event-placeholder`, `html-raw-text`, `event-passive-prevent`) and `contracts/core-api.change-request.md` (v8 to v9: `renderListener` in `idlip/server`, and the event prop comment for block-bodied arrows).
- The todo fixture is the 0002 example without `await`: ids come from a `next` counter and `persist` is left out. `compile-update` rejects `await` until `custom-effects`, so an async fixture would fail its acceptance. The todo also gains a `<form>`, a `<ul>` and a `clear` handler for the brief's `prevent` and key filter cases.
- The fixture sources carry an `oxlint-disable` line for `no-confusing-void-expression` and `explicit-function-return-type`, which the DSL's event arrows and handlers break. The compiler ignores comments.

## Stubs left

- `reference.ts` renders only primitives as text. `ssr-render` ships the real helpers.
- The test mocks `idlip/server` and `idlip/client` with the reference helpers until those subpaths export them.

## Gotchas

- Binding chunks for groups that cover another repeat its bindings and helpers (`t2`, `l3` and `countLeft` are in four todo chunks). That is the price of one request per click.
- The text of a compiled helper should match the source. The fixture copies `countLeft` as the formatter left it, with braces.
- `getChunkFile` maps `*` to `_`, so `todos._.done` and `todos.*.done` would share a file name. Vite adds hashes in a build. A field named `_` next to a list path would collide in the fixtures' scheme only.
- Vitest accepts `vi.mock('idlip/server', …)` with a factory even though the package has no `dist`. A test that imports a compiled fixture needs that mock until the subpaths export the helpers.
- oxfmt wraps a long `<script>` line in a Markdown code block. The real state script is one line.

## Proposed learnings

- A group's chunk includes the bindings of every group it covers | a change under `todos.*.done` always changes `todos`, so one chunk saves a request per click | packages/idlip/src/compiler | yes, the fixture test checks exports against `covers`
- Event arrows and handlers in `.idlip.tsx` files break `no-confusing-void-expression` and `explicit-function-return-type` | the DSL has no return types | oxlint config for `*.idlip.tsx`, examples | yes, by linting an example

## Verification

- `pnpm --filter idlip exec vitest run test/fixtures` (the brief's verify): 26 passed.
- `pnpm --filter idlip test`: 127 passed.
- `pnpm typecheck`: passes.
- `pnpm format:check`: passes.
- `./node_modules/.bin/oxlint --type-aware`: no errors. Four warnings, all in `compile-view-analyze` files from the batch.

## Size

- Estimated L, actual L.
