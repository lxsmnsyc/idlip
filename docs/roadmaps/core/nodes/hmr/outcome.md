# Outcome: hmr

## Built

- `packages/idlip/src/vite/hot.ts`: `classifyEdit(before, after, base, timestamp)` compares two compile results. A different `server` module (markup, manifest, chunk ids) is a `remount` with every chunk URL. The same server module with changed client chunks is a `swap` with those URLs. No change returns `undefined`. `HOT_EVENT` is `idlip:hot`.
- `packages/idlip/src/vite/plugin.ts`: the client `hotUpdate` compiles the new source, classifies the edit, invalidates the file's modules and sends `{ type: 'custom', event: 'idlip:hot', data }`. A module that does not compile sends `full-reload`. The ssr environment keeps Vite's default handling. `compileFile` takes the child flag of the cached compile, since the child scan is async.
- `packages/idlip/src/client/hot.ts`: `connectHot(hot, host)` with the phase `'idle' | 'swapped' | 'remounting'`, `rewrite(url)` and `mergeModel`. A swap makes the next load of a changed chunk import `url?t=<timestamp>`. A remount waits for the loader to settle, snapshots each root's model, fetches the page, swaps in the new `body` element, runs the new state scripts, and patches each root from its fresh model to the merged model. Messages run in order.
- `packages/idlip/src/client/loader/resume.ts`: `load` rewrites the URL and `connectHot` receives the loader's roots, both behind `import.meta.hot`. `src/client/env.d.ts` references `vite/client` for the type.
- A remount also keeps the model of each child (found by slot path through `getChildren` in `nesting.ts`, patched after the root) and starts the `<Subscribe>` sources again after the patches.
- Tests: `test/vite/hot.test.ts` (classification, a dev server edit of a handler and of markup with a spy on `hot.send`, an uncompilable edit, and a production build that has no `idlip:hot`), `test/client/hot.test.ts`, and `e2e/tests/hot.spec.ts` (a browser against `vite dev` of a copy of `examples/todo`: toggle a todo, edit `add`, add a todo, edit the markup, and check the model stays). `e2e/tests/hot-children.spec.ts` (a copy of `examples/counters-subs`: child models kept, the source starts 3 times, then 6). `e2e/fixture/hot-app.ts` makes the copies in `e2e/.hot` (ignored by git). `e2e/playwright.config.ts` has the projects `hot` (`E2E_HOT_PORT`, 4576) and `hot-children` (that port plus one).
- Change request: `contracts/compiled-format-hot.change-request.md`.

Acceptance:

- [x] Handler edit: the e2e test adds a todo after the edit, the text shows the new handler's output, and the toggled state is kept.
- [x] Markup edit: the page shows the new markup with the same todos (3 rows, the toggled one checked).
- [x] Todo loader (`gzip -9`): 3919 B after the rebase, and the built loader file is byte-identical with and without this node (same sha1). `import.meta.hot` folds in the build, so no flag is needed.
- [x] Fast check passes.

## Deviations

- Edited `e2e/playwright.config.ts`, `.gitignore`, `src/client/nesting.ts` (exports `getChildren`) and `test/vite/vite.test.ts` (the old test expected `full-reload`), and added `e2e/tests/hot*.spec.ts` and `e2e/fixture/hot-app.ts`, outside the owned paths.
- The remount does not ask the server for a render with the current model. The entry's `render(url)` takes no model, so the loader renders the fresh page and patches it to the kept model.
- The e2e hot tests edit copies of the examples, not the examples.

## Stubs left

- A child's props come from the fresh render on a remount. Only its model is kept.
- Stale props: a prop the old page changed through its parent's state is set again by the parent's patch, since the parent's model is kept.

## Gotchas

- The patcher caches the nodes it finds by root (`patch/nodes.ts`), so a remount must put in a new `body` element. Replacing the children of the same body leaves the cache stale and the patch does nothing.
- Vite strips only a 13-digit `t=` stamp, so test timestamps must be `Date.now()` sized.
- The dev middleware answers a page only to `Accept: text/html`. Playwright's web server check pings `/@vite/client`.

## Proposed learnings

- A remount replaces the root's `body` element, not its children | `findNode` caches by root | packages/idlip/src/client | yes, `e2e/tests/hot.spec.ts`

## Verification

- `pnpm --filter idlip test`: 604 passed.
- `pnpm build` and the e2e command of the brief: pass.
- `pnpm lint` (warnings only), `pnpm format:check`, `pnpm typecheck`: pass.

## Size

- Estimated M, actual M.
