# Outcome: document-head

## Built

- `<Head>` compiles and runs. Markers, numbering, title rule and server API are in `contracts/compiled-format-head.change-request.md`.
- Compiler: `codegen/head.ts` (binding bodies), `plan.ts` (`heads`, `head-attr` and `head-title` sources), `html.ts` (`addHead`), `chunks.ts` and `index.ts` (dispatch, `manifest.head`).
- Server: `renderPage()` returns `{ head, body }`. `render()` is unchanged and returns the body.
- Client: `client/head.ts` (`startHead`: block hooks and a `MutationObserver` on `<head>`), behind `HAS_HEAD` (`features.ts`, `DETECTORS.HEAD`, one call in `resume.ts`).
- Tests: `test/head/head.test.ts` (server title first, condition add and remove, last title wins, list rows, `<Head>` in a `<Try>` and in a child, title rules, no output without `<Head>`).

## Proof

Todo loader, gzip -9 as the e2e test measures it (one file):

- base (`batch/core`): 3881 B.
- branch, flag off (todo build): 3881 B, +0 B.
- branch, flag on (detector forced on): 4188 B, +307 B.

## Deviations

- The "title stays when no title block is left" rule is dropped, for size. The title falls back to what `<head>` holds then.
- A `<Head>` holds one `<title>` (`head-title-twice`) and elements only.
- No per-block state. The last title is found from the markers in the body, in page order. Server head output is sorted by block number, which follows render order. A `<Head>` in a child component can get a higher number than a later `<Head>` of its parent, so its elements and title can rank after it.
- `render()` still drops head output (DEV warning); `renderPage()` returns it.
- Edited outside the owned and shared paths: `src/testing/index.ts` and `src/testing/compare.ts` (head output in the harness, `i-head` ignored in the compare), `src/compiler/view/codegen/chunks.ts` (dispatch to `emitHeadBody`), `src/client/loader/resume.ts` (one `startHead` call). `patch/blocks.ts` is unchanged.
- A hole in a head title is one `a` binding with the marker as node, not the `t` binding of v10.
- `RenderContext` gained four optional methods (`core/format.ts`).

## Stubs left

- None.

## Gotchas

- `document.title` reads the first `<title>` in `<head>`, so the loader moves the winner first. A host `<title>` without `i-head` is left alone.
- Bindings inside a head element use the marker in the body, so they work in rows and children.
- The title update is async (a `MutationObserver` callback). Tests wait one tick after `settled()`.

## Proposed learnings

- Put DOM work that only one feature needs in its own module behind a flag call in `resume.ts` | an unreferenced module drops out of the bundle | packages/idlip/src/client | no

## Verification

- `pnpm --filter idlip test`: 561 passed.
- `pnpm build && E2E_PORT=5073 E2E_COUNTERS_PORT=5074 E2E_SUBS_PORT=5075 pnpm --filter e2e test`: 14 passed.
- `pnpm typecheck`, `pnpm format:check`, oxlint on `src`: clean.

## Size

- Estimated M, actual M.
