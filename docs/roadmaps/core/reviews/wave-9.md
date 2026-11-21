# Wave 9: the apps milestone closes, one-shot run (2026-11-21)

Landed on `batch/core` since `wave-8.md`. Loader cost is gzip -9 of the todo loader when the flag is on (flag off is 0 B for all of them; the todo loader is 3881 B against the 4096 B contract and the 3900 B e2e test).

- `errors`: `<Try>` regions in the compiler and the server, `try=<id>` chunks. Loader 0 B.
- `errors-client`: swap, `reset`, `idlip:error`, chunk retry, `expectCaught`. `HAS_ERRORS` with `HAS_RETRY` +606 B.
- `prefetch`: `Manifest.listens` and `renderPreload`. Opt-in. Loader 0 B.
- `form-fields`: fields are event paths, submit is prevented, typed `FormElement`. Loader 0 B.
- `hmr`: `idlip:hot` `swap` and `remount` keep the model, dev only. Loader 0 B in a build.
- `document-head`: `<Head>`, `renderPage`, last title wins. `HAS_HEAD` +307 B.
- `svg-and-html`: SVG and MathML namespaces, `html={trusted(v)}` as an `a` binding. Loader 0 B.
- `safe-urls`: `safeUrl$` drops `javascript:` and `vbscript:` in bound URL attributes. Loader 0 B.
- `safe-urls-2`: animation targets, `data:` in frames, `srcdoc` needs `trusted`. Loader 0 B.
- `dynamic-paths`: run-time paths for dynamic holes, `$dynamic` group. `HAS_DYNAMIC` +122 B.
- `deploy-skew`: build id, `build.js`, retention, reload once. `HAS_SKEW` +60 B.
- `loader-trim`: 126 B cut from the flag-off loader (4007 B to 3881 B).

Other flag costs, for the list in `src/client/CLAUDE.md`: tasks +274 B, keyed +124 B, refs about +550 B, children about +650 B, subs +937 B.

## Contracts

All three are `frozen` and match the code on `batch/core`. Where a change request and the code differed, the code won.

- `compiled-format` 11: write sets, nested components, refs and `after`, subscriptions, error regions, head, raw HTML, build id and skew, dynamic holes, form fields, hot updates, `listens`, the flag list. Differences from the requests: `$step` is optional and tested with `in`, `Step.send` and `let-reserved` are not built, `ComponentState` lives in `server/render.ts`.
- `core-api` 11: `Dom` with `Rect`, `renderPage`, `renderPreload`, `safeUrl`, URL rules.
- `view-ir` 11: dynamic holes (`Hole.fallback`), no `form` root, rules `ref-key`, `dom-call-position`, `event-computed-key`.

Seventeen change requests are `applied`. The nested `CLAUDE.md` files of `client` and `vite` gained the flag costs, the budget meaning, the skew rules and the no-fixed-waits rule. `compiler/CLAUDE.md` is new (URL attributes, `trusted`, helper names, ids).

## Decisions of the one-shot run (user can revisit)

- Title rule: the last `<title>` in page order wins. No per-block state, and a head title does not come back when its block leaves.
- Prefetch is opt-in (`renderPreload`). It cuts the cold first click from 221 ms to 60 ms but loads two chunks before any event, and `examples/todo` cannot reach its module's `manifest` and `chunks` with types.
- Skew is on by default (+60 B). It needs `build.js` served with `no-store` and `build.outDir` kept between deploys.
- Safe URLs: bound URL attributes drop `javascript:` and `vbscript:`. `iframe src`, `embed src` and `object data` also drop `data:` except raster images. `srcdoc` needs `trusted`. A literal in source is not checked. `trusted` does not sanitize.
- Raw HTML is an `a` binding through the loader's `parseHtml`, with no flag.
- Dynamic holes are tracked only at the top level of a root component. Elsewhere they bind with static fallback paths.
- A `submit` event is always prevented, except a forwarded message prop.

## Open items (`inbox.md`)

- `loadBindings` runs every export of a chunk (matters only with a merge threshold).
- The bench harness reads the todo count with a regex that can read "32".
- Type-aware oxlint does not read `.idlip` files.
- The `nest.test.ts` flake is being fixed by `fix-flaky-tests-2` (still active in its own worktree).
- Decide whether `examples/todo` and the GOAL line "nothing loads before the first event" use prefetch by default.
- Not built and not tracked by a node: `Step.send`, `let-reserved`, tracked dynamic holes in rows, branches and children, `HAS_KEYED` detector reading handler `writes` (for `keyed-writes`), `build.js` header on the website.

## What waits on what

Everything left waits on the batch cut into `main` (PR #1). After it merges: `fix-flaky-tests-2` closes, `markup-ts-plugin` starts (after the story merges), then `website-scaffold`, the docs nodes (`docs-start`, `docs-effects`, `docs-nesting`, `docs-reference`, `docs-platform`, `docs-benchmarks`), `website` (gate: the user deploys), `release-0-1`. `keyed-writes` and `update-ops` (0.2) are held by the release fence. Briefs of the todo nodes carry "Updates after wave 9".

## After wave 9 (2026-11-21)

- PR #1 merged into `main` (c818d4c): the first cut, 31 nodes. `main` is merged back into `batch/core`.
- Debate `debates/dsl` settled on TSX as the one source syntax. The `markup-frontend` story, its children and `markup-ts-plugin` are dropped; `feat/markup-frontend` stays as history.
- Nothing is active. Ready next: `website-scaffold`, then the docs nodes and `website` (gated: the user deploys). `keyed-writes` and `update-ops` wait for `release-0-1`.
- `batch/core` carries 6 roadmap-only commits since the cut (the DSL debate and drops). They reach `main` with the next cut.
