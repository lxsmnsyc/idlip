# Outcome: chunk-helpers

## Built

- `packages/idlip/src/core/helpers.ts`: one source for `text$`, `attr$`, `on$`, `setText$`, `setAttr$`, `setOn$` and `setBranch$`, with the small functions they call. `printHelpers(names)` returns the text of the functions a chunk needs (dependencies first) and the loader exports they call. `HELPER_NAMES` lists the names a copy defines.
- `src/server/helpers.ts` re-exports `text`, `attr` and `on` from it. `idlip/server` is unchanged.
- Codegen (`chunks.ts`, `text.ts`): a binding or list chunk gets the copies after its imports. The only `idlip/client` import is what the copies call, for example `parseHtml as parseHtml$`. A module-level declaration or import named like a generated name (`HELPER_NAMES`: the helpers and the forwarders) is a compile error `module-reserved-name` that names the clash and asks for a rename. Only generated locals (state fields and the like) get a `$` suffix.
- `src/client/patch/dom.ts` no longer holds the helpers. `nodes.ts` clears its node cache from a block hook, which a copied `setBranch` fires.
- Tests: `test/core/helpers.test.ts` (10: the copy runs alone and acts like the source, dependency order, no comment or module reference in a copy, names reserved, the node cache after a swap) and `test/compiler/view/codegen/helpers.test.ts` (3: chunk imports are loader exports, and the two `module-reserved-name` cases).

## Proof

- base: 24dcb00, `pnpm --filter idlip exec vitest run test/compiler/view/codegen/helpers.test.ts` failed: 16 chunk imports (`setAttr`, `setBranch`, `setText`, `setOn`, `attr`, `on`, `text`) that `idlip/client` does not export. Loader minified with rolldown (`minify: true`, `src/client/index.ts`), gzip -9: 3831 B.
- branch: the same test passes. The vite loader-graph tests pass on the fixture app. Loader: 3844 B (+13 B for the cache hook), under 4096 B.

## Deviations

- The block hook that clears the node cache skips blocks inside a row, and `clearNodes` is no longer exported.

- Golden chunks changed (`test/fixtures/*/expected/client/binding.*.js`, `list.3.js`): helpers are copied in, and calls use the `$` names. Regenerated with the generator and oxfmt.
- Sizes of `binding=todos.*.done`: before 521 B raw, 272 B gzip -9 (helpers in the loader). After 1832 B raw, 694 B gzip. Minified like a build: 338 B raw, 225 B gzip before; 940 B raw, 505 B gzip after. `list=3`: 338 B before, 1429 B after (raw). A chunk pays for its helpers, and the loader no longer does. A todo click loads the same chunks as before.
- Edits outside the brief's paths: `test/client/patch/patch.test.ts` (import), `test/vite/client-stub.ts`, `test/vite/vite.test.ts`. The loader-graph error test now makes every chunk import `parseHtml`, since the fixture chunks barely import the loader and the bundler inlined the stub.
- The copies are the text of `Function.prototype.toString`. They have no comment in the body and call loader exports through local forwarding functions, because Vitest and bundlers rewrite imported names in function text.

- `e2e/tests/support.ts` `serializeNode` (outside the brief's paths, asked by the coordinator): live `value`, `checked` and `selected` replace the attributes before comparing with a fresh render. The stub `setAttr` used to set the `checked` attribute too, and the real one sets only the property, as the contract says.
- The `binding=todos.*.done` chunk carries only what it uses: `setAttr$` (`a4`, `a5`) with `joinClass$` (the `class` object), `setText$` (`t2`) and `getText$` (both call it). It grew from 338 B to 940 B minified because `setText$` and `setAttr$` moved out of the loader. No other helper is copied.

## Stubs left

- `e2e/fixture/stub/client.js` still stands in for the helpers. The todo chunks no longer use it.

## Gotchas

- A new helper needs an entry in `HELPERS` and a name with a `$` suffix. `printHelpers` throws when a bundler renames a helper or a forwarder.
- The copy runs in the chunk's realm, so `start.ownerDocument` is the page's document.
- A condition chunk imports `parseHtml`, `findInnerBlocks`, `removeBlock` and `addBlock` from `idlip/client`. The loader holds all four.

## Proposed learnings

- Copy code into generated output from function text only if the function calls module-local names | Vitest and bundlers rewrite imported bindings in function text | packages/idlip/src/core | yes, `helpers.test.ts` runs the copies in a scope with only the loader's exports

## Verification

- `pnpm --filter idlip test`: 336 passed (17 files).
- `pnpm format:check`, `pnpm typecheck`, `./node_modules/.bin/oxlint --type-aware` (0 errors), `pnpm build`: pass.
- `pnpm --filter e2e test`: 8 passed.

## Size

- Estimated M, actual M.
