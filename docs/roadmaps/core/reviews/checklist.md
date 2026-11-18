# Blindspot checklist

- **Data and migrations**: N/A. No stored data. The state script format is versioned by `compiled-format`, and server and client always come from the same build.
- **Compatibility**: `compiled-format` fixes the DOM encoding and manifest. A page rendered by one build and resumed by another is out of scope for this roadmap. `vite-plugin` puts a build id in the manifest so a mismatch fails loudly.
- **Auth and permissions**: N/A. A UI library with no server endpoints of its own.
- **Failure modes**: `resume-loader` covers a chunk that fails to load (queued events are kept, the error is reported). Tested in its suite.
- **Concurrency**: `resume-loader` acceptance covers two clicks before a chunk resolves. Two messages updating the model in one tick are applied in order.
- **Limits**: `patch-lists` model test covers empty and large lists. Model size in the state script is reported in `example-todo` outcome.
- **Security**: `ssr-render` escapes text, attributes and the state script (`</script>` test). Messages in the DOM are parsed as data with `JSON.parse`, never evaluated.
- **Observability**: N/A for this milestone. `devtools` outline covers the message log later.
- **Performance**: The milestone metric is bytes and chunks loaded on the first click, measured by `e2e-harness`. `resume-loader` reports its gzipped size. `benchmarks` outline compares against Qwik, Marko and brumate.
- **Testing**: Golden fixtures from `compiled-format` are the shared target. fast-check property and model tests in `patch-bindings` and `patch-lists`. Playwright in `e2e-harness`. All checks run in parallel worktrees: no fixed ports except the e2e server, which picks a free port.
- **Local files**: N/A. No gitignored inputs.
- **Developer experience**: `compile-view-analyze` has one diagnostic test per view rule. `jsx-types` rejects closures at type level. Docs in the `website` outline.
- **Rollout**: N/A. Pre-release, version `0.0.0-stage`.
- **Cleanup**: Stubs: `e2e-harness` serves the fixture until `example-todo` switches it. `compile-view-codegen` stubs the update splitter until `compile-update` lands. Both replacements are acceptance items of the replacing node.
- **Coverage**: Built from `docs/proposals/0001-dsl.md`. Every proposal section maps to a node: Messages, Model, Update to `core-api`. View to `jsx-types`, `compile-view-analyze`, `compile-view-codegen`. Patching to `patch-bindings`, `patch-lists`. Commands and subscriptions to `commands-subs`. Nesting to `nesting`. Compiler output to `compile-update`, `vite-plugin`. Open questions to `spike-view-analysis` and `compiled-format`.
- **Dependencies**: `seroval` (MIT, same author), `oxc-parser` (MIT), `vite` (MIT, optional peer), `fast-check` (MIT, dev), `happy-dom` (MIT, dev), `@playwright/test` (Apache-2.0, dev, e2e only). All installed by `core-api` except Playwright.
