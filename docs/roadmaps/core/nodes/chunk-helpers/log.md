# Log: chunk-helpers

- Base: batch/core at 24dcb00. Loader minified (rolldown 1.3.2, `minify: true`, entry `src/client/index.ts`, gzip -9): 3831 B.
- Proof, base: `pnpm --filter idlip exec vitest run test/compiler/view/codegen/helpers.test.ts` fails. Chunks of the counter, the todo and a condition fixture import `setAttr`, `setBranch`, `setText`, `setOn`, `attr`, `on` and `text` from `idlip/client`, which no longer exports them.
- Design: `src/core/helpers.ts` holds one source per helper. Codegen copies the text of the functions (`printHelpers`). Names end in `$` so a copy cannot clash with module locals. Loader exports that `setBranch` calls (`parseHtml`, block hooks) are imported by alias.
- Found: Vitest and bundlers rewrite imported names inside a function's text (`__vite_ssr_import_0__.parseHtml`). Fix: helpers call local forwarding functions named `parseHtml$` and so on, which a chunk replaces by an import alias.
- Found: `setBranch` called `clearNodes()` of the patcher. Now `nodes.ts` registers `onBlock(clearNodes, clearNodes)`, so the copy needs no private export. Loader +13 B.
- Golden chunks regenerated with the generator and oxfmt. `unalias` is gone from the codegen and compile tests.
- Out-of-path edits, each small: `test/client/patch/patch.test.ts` (import of `setBranch`), `test/vite/client-stub.ts` and `test/vite/vite.test.ts` (stub exports; the loader-graph error test needs chunks that import the stub).
- e2e: `pnpm --filter e2e test` gives 7 passed, 1 failed (`the DOM after each action equals a fresh server render`). The harness stub `e2e/fixture/stub/client.js` set the `checked` attribute as well as the property. The real `setAttr` sets only the property, as the contract says, so the fixture page's `checked=""` attribute is stale after a click. For `example-todo` or `e2e-harness`: compare properties, or sync `checked` in `readMain`.
