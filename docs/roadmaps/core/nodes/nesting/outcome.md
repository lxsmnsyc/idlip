# Outcome: nesting

## Built

- `packages/idlip/src/compiler/index.ts`: `compile(source, id, options)` forwards `child` and `resolve` to `generate`. New exports `listChildren(source, id)` (the import specifiers of the stateful children a module renders) and the type `CompileOptions`.
- `packages/idlip/src/vite/plugin.ts`: `findChildren()` finds every module that another module of `modules` renders, resolving each specifier through Vite's resolver (an alias or a bare specifier works), and `compileFile` compiles those with `child: true` and a `resolve` that returns what the scan resolved. A module that is also a root takes the same output, since `child: true` only adds the `view` chunk. The set resets on `hotUpdate` (every environment) and `watchChange`. The cache key includes `child`. The `compile` option takes the optional third argument. `checkChunkImports` allows a view file only as an import of a list chunk or of a view facade.
- `packages/idlip/src/vite/chunks.ts`: `view` is a chunk name (`parseChunkId`) and `listChunks` lists `manifest.view`.
- `packages/idlip/src/client/loader/resume.ts`: the `startSubs` loader finds the unit of the marker (`nest.target`) and loads `source=<name>` from that unit's manifest, so a `<Subscribe>` in a child uses the child's module. Rebased onto `commands-subs`.
- `examples/counters/`: `Board` (a keyed `<For>` of `Counter` children, `remove` in the parent) and `Counter` (state `count`, props `label`, `start`, message prop `onRemove`, and ). `examples/counters-subs/` is a copy whose `Counter` also has a `<Subscribe>` with a source that waits for its signal.
- `e2e/tests/nested.spec.ts` (3 tests), `e2e/tests/nested-subscribe.spec.ts` (the child's source chunk; it fails without the resume.ts change) and `e2e/playwright.config.ts`: projects `chromium` (todo, `E2E_PORT`, 4173), `counters` (`E2E_COUNTERS_PORT`, 4174) and `counters-subs` (`E2E_SUBS_PORT`, 4175). `E2E_TARGET=fixture` runs the todo project only.
- Tests: `test/vite/vite.test.ts` (view chunk, `listChildren`).
- `HAS_CHILDREN` stays on: the parent's server code has `uses` and the child's manifest has `view`, so `buildStart` detection sees both. The todo loader keeps the flag off.

## Proof

Not a problem-fix node.

- Counters loader (gzip -9, one file, no static imports): 4918 B (children on, subscriptions off; 5771 B in `examples/counters-subs`, which also has a subscription). The todo loader is 4010 B.
- Requests on the first click of `+` on a child: `handler=increment`, `binding=count`. No parent chunk, no `view`, no list chunk. A click on another child then loads nothing. The DOM equals a fresh server render after each click and each remove (a counter's state is the `start` prop of the fresh render).

## Deviations

- Edited `packages/idlip/src/vite/chunks.ts` and the plugin check, and added tests to `test/vite/vite.test.ts`, all outside the owned paths, as the brief allows for `compile()` and the plugin.
- The `view` chunk is emitted as an entry, as `listChunks` says, and the parent's list chunk imports it statically, so Rolldown puts its code in a shared chunk. The plugin check now allows that chunk. A click on a child never loads it.
- `e2e/fixture/chunk.ts` and `chunk.spec.ts` know the `task`, `source` and `view` built files.
- Added `examples/counters-subs/` and `e2e/tests/nested-subscribe.spec.ts`, outside the owned paths, to keep `examples/counters` plain.
- The e2e config has two web servers and two projects instead of one `baseURL`.

## Stubs left

- Stateless imported components: `compile()` passes no `readImport`, so an imported stateless component is a child block. Not in scope here.

## Gotchas

- A child is found only if a module in `modules` imports it and renders it in JSX.
- The `children` set is computed on first use and reset in `buildStart` and `hotUpdate`.
- The e2e servers use ports 4173 to 4175. Set `E2E_PORT`, `E2E_COUNTERS_PORT` and `E2E_SUBS_PORT` to run beside another worktree.

## Proposed learnings

- Compile a module as a child when any other module renders it | one source decides the `view` chunk | packages/idlip/src/vite | yes

## Verification

- `pnpm build`, `pnpm lint` (warnings only, none new), `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm --filter e2e test` (13 passed): all pass.

## Size

- Estimated S, actual S.
