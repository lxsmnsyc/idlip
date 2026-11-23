# Log: fix-style-object

- Reproduced: `style={{ color: x }}` went through `attr$`, whose `getText$` wrote `[object Object]`. `setAttr$` and `putAttr$` handled any object as a class record.
- Fix: a new helper `joinStyle$` in `core/helpers.ts` converts a record to CSS text. `attr$`, `setAttr$` and `putAttr$` use it when the attribute is `style`. The helpers live in the shared `idlip/helpers` module, not the loader, so no flag was needed.
- Static objects whose keys and values are all literals fold to a string in `foldStyle` (`analyze.ts`). An empty result writes no attribute.
- Types: `StyleValue` in `jsx/elements.ts`, exported from `idlip/jsx-runtime`.
- Loader: no file under `src/client` changed, so the todo loader stays at 4087 B gzip. The e2e `loaderBudget` passes.
- The click tests call `settled()`, which compares the page with a server render of the model. That is the server-vs-client check. I did not add a differential subject, since `test/differential/subjects.ts` is not an owned path.
- The worktree had no linked workspace deps. `pnpm install --frozen-lockfile --offline` fixed the build and typecheck.
