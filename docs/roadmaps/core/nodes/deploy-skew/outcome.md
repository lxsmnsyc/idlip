# Outcome: deploy-skew

## Built

- `packages/idlip/src/client/skew.ts`: `checkSkew()` imports `build.js` from the loader's folder and calls its `check()`. `resume.ts` calls it under `HAS_SKEW` when a chunk fails for good (after the retry of `errors-client` when `HAS_RETRY` is on). The loader holds only this call.
- `packages/idlip/src/vite/skew.ts`: `getBuildSource` (the text of `build.js`: the id as default export and `check()`, which reloads once per build and tab, state `'fresh' | 'reloaded'` kept in `sessionStorage['idlip:builds']`), `getBuildId`, `keepBuilds`, `findLoaderFile`.
- `plugin.ts`: option `skew` (default on, documented in its TSDoc, including the `no-store` rule for `build.js` and the retention requirement). Client build: `emptyOutDir: false`, build id from the bundle file names, `build` key in `chunks.json`, `build.js` next to the loader, deletion of older builds' files in `writeBundle`. `features.ts` (vite): `getDefines(on, skew)` sets `__IDLIP_HAS_SKEW__`.
- `src/server/render.ts`: `i-build` on the state script, taken from the `build` key of the chunk map, which does not reach the state value.
- Change request: `contracts/compiled-format-skew.change-request.md`.
- Tests: `test/client/skew.test.ts` (the `build.js` check: reload once, no loop, same build, no id), `test/vite/skew.test.ts` (ids, retention, attribute, three real builds keep two), `e2e/tests/skew.spec.ts` (an old page served against the new build reloads and then works; an old page that keeps coming back reloads once). The e2e test relies on the loader's own failure, with no self-fired event.

## Proof

Todo loader, gzip -9 of the loader file as the e2e budget test reads it (on `batch/core` with `errors-client`):

- base and `skew` off: 3919 B (0 B over base).
- `skew` on (default): 3979 B (+60 B). The first version checked in the loader and cost +166 B.

## Deviations

- The server's build is read by importing `build.js`, not by `fetch`: the todo example's CSP (`default-src 'none'`) blocks fetches. The check lives in `build.js`, which the current build always serves, so a page two builds old still recovers.
- The trigger is the final failure in `load`, not an `idlip:error` listener, so `skew` needs neither `HAS_ERRORS` nor a `HAS_RETRY` define.
- `HAS_SKEW` has no `DETECTORS` line (the brief asks for an option). `getDefines` takes a second argument.
- Edited outside owned and shared paths: `test/vite/vite.test.ts` (the chunk map has a `build` key, and `build.js` is not a chunk), `test/client/subs/build.test.ts` (the loader lookup skips `build.js`), `e2e/tests/skew.spec.ts` (new).

## Stubs left

- None.

## Gotchas

- Serve `build.js` with `Cache-Control: no-store` or a short max age. A cached copy hides a new deploy.
- Retention reads `<outDir>/.idlip/builds.json`. It does nothing on a clean CI checkout unless the previous build is restored. It deletes only files that record lists, never `publicDir` copies. With `skew` on, stale files from before the first skew build stay until `dist` is removed.

## Proposed learnings

- Put a check that runs only after a failure in a file the build serves, and import it on failure | the loader pays for every byte on every page | packages/idlip/src/client | no
- Learn the server's state with a script `import()`, not a `fetch` | an app with a strict CSP blocks `fetch` | packages/idlip/src/client | no

## Verification

- `pnpm --filter idlip test`: 659 passed.
- `pnpm build && E2E_PORT=8073 E2E_COUNTERS_PORT=8074 E2E_SUBS_PORT=8075 E2E_HOT_PORT=8076 pnpm --filter e2e test`: 18 passed.
- `pnpm typecheck`, `pnpm format:check` and `rtk proxy pnpm lint` (no errors) clean.

## Size

- Estimated M, actual M.
