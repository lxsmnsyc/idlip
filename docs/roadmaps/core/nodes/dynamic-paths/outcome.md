# Outcome: dynamic-paths

## Built

- Analysis (`analyze.ts`): `createHole(node, scope, dynamic)` returns `paths: 'dynamic'` for a text or attribute hole where a helper that is not inlined takes an object of model fields (`isTracked`). Two sources: an alias of the model (`const view = { todos, filter }` passed to a helper) and the whole `props` of a stateless component passed to a helper (was `props-whole`, which stays for a computed key). A hole that reads a loop variable, the event, a catch error or an impure global stays static.
- Code generation: `codegen/dynamic.ts` (`printTracked`), `plan.ts` (`bindDynamic`, `Plan.dynamic`), `index.ts` (the `$dynamic` group, `const dynamic$ = {}` and `dynamic: dynamic$` in the server), `expr.ts` (`tracked`: state prints as `model.x` on the server, and an object prints with getters so a helper reads fields lazily), `chunks.ts`, `html.ts`.
- Runtime: `core/dynamic.ts` `track$(store, name, model, read)` runs `read` on a proxy of the model, records own-field reads (array index as `*`, a path that starts a longer one dropped; `in`, `Object.keys` and spreads record `<path>.*`) and stores them. The server imports it as `track` from `idlip/server`; client chunks hold a copy (`core/helpers.ts`), so the proxy is not in the loader.
- Loader (`client/dynamic.ts`, `HAS_DYNAMIC`): `getDynamic` diffs the recorded paths, `isIdle` skips unchanged dynamic holes, `patch.ts` selects the `$dynamic` group. `Page.dynamic` and `Scope.dynamic` come from `PageState.dynamic`. `server/render.ts` writes `dynamic` in the state script.
- Detector: `DYNAMIC` in `vite/features.ts` (the manifest has `$dynamic`).
- Tests: `test/dynamic/dynamic.test.ts`, fixtures `test/fixtures/dynamic/{dynamic,pick}.idlip.tsx`, analyzer fixture `dynamic.idlip.tsx.txt`, flag tests in `test/vite/features.test.ts`.
- Change requests: `contracts/view-ir-dynamic.change-request.md`, `contracts/compiled-format-dynamic.change-request.md`.

## Deviations

- Edited outside owned and shared paths: `core/helpers.ts` (the `track$` entry), `server/helpers.ts` and `server/index.ts` (export `track`), `compiler/view/codegen/{chunks,expr,html,index}.ts`, `test/compiler/view/analyze/analyze.test.ts` and the `violations` fixture and snapshot (the `props-whole` case now uses `props[props.x]`; the "never dynamic" test skips `dynamic.idlip.tsx.txt`), `test/vite/features.test.ts`.
- Inside `<For>`, conditions, `<Try>` and child components a dynamic hole binds with its static fallback paths (`Hole.fallback`), as on the base, since client templates record no reads. `hole-dynamic` is no longer reported.
- Every handler entry with `bindings` lists `$dynamic`, so the chunk preloads with the handler. A handler with no write set keeps no `bindings` and no preload.
- `track$` lives in `core/dynamic.ts`, not `server/dynamic.ts`, so `core` imports nothing from `server`.

## Stubs left

- Tracked holes in rows, branches and child components. They need a template render that records reads.
- A recorded path never uses a keyed segment; it falls back to `*`.
- A record read by many different keys stores one path per key, so its `PageState.dynamic` entry grows with the key count. Not collapsed.

## Gotchas

- Reads that happen when an object is built count as reads, so tracked objects print getters.
- The proxy wraps only plain objects and arrays. A Map, Set or Date is returned as is, and its path counts as read.
- `track$` is copied with `toString()`: no comment in the body and no outside names.

## Proposed learnings

- A copied helper holds no comment in its body and no outside name | the compiler copies its text | packages/idlip/src/server | no

## Verification

- `pnpm --filter idlip test`: all pass.
- `pnpm build && E2E_PORT=6073 E2E_COUNTERS_PORT=6074 E2E_SUBS_PORT=6075 E2E_HOT_PORT=6076 pnpm --filter e2e test`: 14 passed.
- Todo loader gzip -9 (the e2e method): 3881 B on `batch/core` and on the branch, so the flag-off cost is 0 B. With the flag forced on (todo build): 4003 B, +122 B. Todo goldens are unchanged.

## Size

- Estimated M, actual M.
