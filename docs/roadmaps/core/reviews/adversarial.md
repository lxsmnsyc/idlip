# Adversarial review

A fresh-context agent reviewed contracts, shared files and dependency edges. Each finding was checked against the briefs and the code.

## Applied

1. `compiled-format` froze before the chunk scheme and the view IR. Added a `contract` edge on `spike-view-analysis` (`view-ir`) and a `hard` edge on `spike-chunk-split`. `view-ir` no longer decides the DOM encoding.
2. Nothing wired `compile()` end to end. Added `compile-integration` (S), which owns `src/compiler/index.ts`. `vite-plugin` and `example-todo` now depend on it.
3. Contracts were vague. `core-api` now defines `createMessage`, the `defineUpdate` generics, `cmd.none`, `cmd.batch`, `Subscriptions` with falsy entries, and how class instances are rejected (at render time). `compiled-format` now fixes the `[tag, payload]` tuple to `{ t, p }` mapping, an async `patch`, `diffPaths`, `patchList` and the effects seam (`runCmd`, `startSubs`).
4. Shared config had no owner. `core-api` now owns the root `package.json`, `tsconfig.json`, `vitest.config.ts`, the oxfmt and oxlint configs, and the tsdown externals, with the changes listed in its steps.
5. `src/client/index.ts` had no owner. `resume-loader` owns it. `commands-subs` shares `src/index.ts`.
6. `example-todo` had to edit `e2e/` and the lockfile. `e2e-harness` now reads the target from `E2E_TARGET`. `example-todo` shares `e2e/playwright.config.ts` and `pnpm-lock.yaml`. The lockfile is shared, not owned, in `core-api`.
7. `patch-lists` had a `hard` edge on `patch-bindings`. It is now `behavior` through `compiled-format`, with `patch()` owned by `patch-bindings` and `patchList` by `patch-lists`.
8. Fixed the stale `compile-view` name in `compiled-format`.

## Rejected

- Listing brumate benchmark tooling as an input to `benchmarks`. The node is an outline; inputs are decided when `plan.py refine` lists it.
