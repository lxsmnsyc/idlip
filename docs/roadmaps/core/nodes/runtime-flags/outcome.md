# Outcome: runtime-flags

## Built

- `packages/idlip/src/client/features.ts`: `HAS_TASKS` and `HAS_KEYED`. Each is `typeof __IDLIP_HAS_X__ === 'undefined' || __IDLIP_HAS_X__`, so every flag is on without the plugin (tests, `idlip/testing`, dev).
- `packages/idlip/src/vite/features.ts`: `DETECTORS` (flag name to a function of the compile result), `getFeatures`, `getDefines`, `replaceFeatures`. `TASKS` is on when a manifest has `tasks`. `KEYED` is on when a binding group path has a `[` segment.
- `packages/idlip/src/vite/plugin.ts`: `buildStart` of the client environment compiles every module, unions the features and keeps the defines. `transform` replaces the globals in the client modules that name them. The compile runs before any module is bundled, so the loader sees the defines. A `declare const` line in TypeScript source is left alone.
- `resume.ts`: `apply` takes the task path only when `HAS_TASKS`. `diff.ts`: the keyed segment is read only when `HAS_KEYED`.
- Tests: `test/vite/features.test.ts` (detection, replacement, and three client builds with the real loader: no flags, tasks, keyed).

## Recipe for a new flag

1. In `src/client/features.ts`, add `declare const __IDLIP_HAS_NAME__: boolean | undefined;` and `export const HAS_NAME: boolean = typeof __IDLIP_HAS_NAME__ === 'undefined' || __IDLIP_HAS_NAME__;`.
2. In `DETECTORS` of `src/vite/features.ts`, add one line: `NAME: ({ manifest }) => <test of the compile result>`.
3. Put the loader code behind `if (HAS_NAME)` (or `HAS_NAME && ...`) so the bundler can fold it.

## Proof

Loader gzip -9 sizes (loader plus static imports):

- base (`batch/core` plus `run-tasks`, todo build): 4342 B, over the 4096 B budget.
- branch, todo build (`examples/todo`): 3926 B. The e2e budget test passes.
- Test fixtures built with the real loader, minified:
  - no feature: 3897 B.
  - uses tasks (the `effects` fixture): 4171 B, over the budget.
  - keyed path only: 4021 B.

The orchestrator decided: the 4096 B budget is the loader with no optional features. Each feature's cost is reported, not capped. Tasks: 4171 B total for the `effects` fixture (+274 B). Keyed paths: 4021 B (+124 B).

## Deviations

- `idlip()` returns two plugins (`idlip` and `idlip:features`) so each `transform` has a hook filter: `id` for the compile path and `code` for the replacement. It still works in `plugins: [idlip()]`.
- A module that the server build compiles but `buildStart` did not count (a component from a dependency, outside `modules`) fails the build when it needs a flag that is off. The error names the file and the flag.
- `replaceFeatures` returns `map: null`. Each name becomes a literal on its own line, so lines stay the same.
- `HAS_KEYED` gates the keyed segment (`todos[id=selected]`) only. The pairing of `*` items by key under a keyed `<For>` stays on, since `todo` has one and dropping it can miss a change after a reorder.

## Stubs left

- None.

## Gotchas

- The plugin replaces text, so a flag name must not appear in other code. `replaceFeatures` skips `declare const` lines only.
- A flag counts only for modules under the plugin's `modules` globs. A component outside them that needs a flag that is off fails the build.

## Proposed learnings

- Put loader code that only some apps use behind a `HAS_*` flag | the loader has a 4096 B gzip budget | packages/idlip/src/client | no

## Verification

- `pnpm build && pnpm --filter e2e test`: 10 passed.
- `pnpm --filter idlip test`: 437 passed.
- `pnpm lint` (no errors), `pnpm typecheck`, `pnpm format:check` clean.

## Size

- Estimated M, actual M.
