# Outcome: cloned-templates

## Built

- `packages/idlip/src/compiler/view/codegen/template.ts`: `canClone(nodes, namespace, plan)`, `buildClone(...)`, `printClone(name, body)`. A client row or condition branch of elements, static text and text holes, with at least one write, compiles to a static template HTML and a list of writes. `i-x="<n>"` marks a written element and `<!--x<n>-->` a text hole.
- `packages/idlip/src/core/helpers.ts`: copied helpers `clone$(template)` (parses the template once per document through the loader's `parseHtml`, swaps each `<!--x<n>-->` for a text node, keeps the child path of each mark; per render `document.importNode` plus the path walk), `putAttr$` (writes an attribute as `attr$` would have in the HTML), `putText$` (removes the node for an empty text). `setBranch$` takes a string or a node.
- `chunks.ts`: the list chunk declares `const template$ = { h: '<!--i-->...<!--/i-->' }` and `render` returns the fragment. A condition chunk declares `templateC<id>_<branch>$` per cloned branch.
- `client/list/index.ts`: `patchList` inserts a fragment from `render` as is and does not walk it for blocks. `ListChunk.render` returns `string | DocumentFragment` (`core/format.ts`).
- The clone holds the same nodes the HTML parses to, row and `<!--t-->` markers included. Client-made rows keep their markers, so `patchRow`, `readRows` and `findNode` need no change, and the differential normalization did not change.
- Tests: differential subject `cloned` (holes next to static text, empty text, class objects, boolean, URL and form attributes, event messages that read the row, rows in a `<tbody>`, a disclosure with both branches cloned); `test/compiler/view/codegen/template.test.ts` (a disclosure branch renders through a clone, opened and closed by clicks; row chunk shape; fallbacks); list chunk tests compare rows as DOM through `test/fixtures/rows.ts`.
- `benchmarks/harness/rows-ab.mjs`: interleaved A/B of rows operations between two copied `dist/` folders. `client.mjs` exports `measureOperation`.
- Change request: `contracts/compiled-format.v16.change-request.md`.
- Separate fix commit: the examples' dev pages loaded `/@id/idlip/client` while chunks import the resolved `/@fs/.../dist/client/index.js`, so a chunk that imports the loader ran a second copy of it. The hot e2e test failed once list chunks imported `parseHtml`. The dev default is now an inline `import 'idlip/client'`.

## What falls back to HTML strings

Children, nested `<For>` and conditions inside the body, `<Try>`, `<Subscribe>`, `<Head>`, global listeners (`<template i-global>`), `html=` raw HTML, dynamic holes (`track$`), holes in `script`/`style`/`textarea`/`title`, text holes directly under `table`/`thead`/`tbody`/`tfoot`/`tr`/`colgroup`/`select` (the parser moves text there), SVG and MathML bodies (`namespace` not `html`), empty bodies, and bodies with no write (a static body parses quickly and `clone$` would cost more bytes). The server render and the view chunk do not change.

## Proof

Machine: Apple M2, 8 GB, Chrome 158, Node 26.12.1. Base: `batch/core` 25f491a, rows app built into `.ab/base`. Branch: final code, built into `.ab/final`.

### Profile: where create time goes

`node benchmarks/harness/profile-rows.mjs idlip <op> 10` on unminified builds, load average 2.6 to 3.2. Script and native work a round, ms (self time of the top entries).

| Op                 | base | branch | Base top costs                                                                                                              | Branch top costs                                                                                                                                |
| ------------------ | ---- | ------ | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Create 1,000       | 15.0 | 7.6    | `parseHtml` 7.28, GC 1.56, `before` 1.55, `collectBlocks` 0.88, `createHTML` 0.73, `isComment` 0.70, `render` (string) 0.61 | `importNode` 1.53, `before` 1.18, `setAttribute` 1.02, `clone$` 1.00, GC 0.92, `patchList` 0.41, `putText$` 0.20, `setOn$` 0.19, `render` 0.10  |
| Replace 1,000      | 19.1 | 16.4   | `parseHtml` 6.36, `remove` 2.76, `collectBlocks` 1.84, `before` 1.35, `createHTML` 0.55                                     | `remove` 3.06, GC 2.07, `importNode` 1.47, `setAttribute` 1.21, `before` 1.19, `clone$` 1.03, `collectBlocks` 0.72, `isComment` 0.53            |
| Append 1,000 to 1k | 22.2 | 17.1   | `parseHtml` 6.43, `before` 1.54, GC 1.35, `walk` 1.19, `findNodes` 1.09, `setAttribute` 0.88, `collectBlocks` 0.70          | GC 2.30, `setAttribute` 2.10, `importNode` 1.32, `before` 1.16, `walk` 1.13, `clone$` 0.92, `findNodes` 0.79, `patchList` 0.77, `patchRow` 0.29 |

About 1 to 2.5 ms in every profile is the harness's own `waitForFunction` (`query :5815`, `(anonymous) :5813`). "(program)", 23 to 33 ms on both sides, is style, layout and paint, which this change does not touch.

What remains after the clone, for the orchestrator:

- Create: the clone itself is about 5 ms (`importNode`, `setAttribute` for the class and two `on:click` messages, path walk, insert). Brumate's 5.3 ms is the same order.
- Replace: `removeRange` per old row: native `remove` 3.1 ms plus the block walk `collectBlocks`/`isComment` 1.25 ms. Clearing the range at once, or skipping the walk for rows known to hold no blocks, is the next step (`perf-list-kept` or a new node).
- Append: the kept-row pass (`walk`, `findNodes`, `patchRow`, `setAttribute` of the `id_selected` class binding on 1,000 kept rows), about 4 ms. This is `perf-list-kept`'s target. Brumate keeps the cloned elements on the row scope for this; idlip's cloned rows still use markers, so the pass reads them from the DOM as before.
- GC grew by 0.5 to 1 ms: `clone$` allocates the nodes array per row.

### A/B

`node benchmarks/harness/rows-ab.mjs --dir base=.ab/base --dir branch=.ab/final --runs <n> [--ops ...]`, click to paint, ms, median (MAD). Noise is 3 x the larger MAD. Load average at the start under 3 for runs 2 to 4; run 1 started at 2.6 and rose to 7 (other work on the machine).

| Op                 | Run 1 (9 runs, earlier build)                     | Run 2 (11 runs)                                          | Run 3 (21 runs)                                          | Run 4 (31 runs)                                  |
| ------------------ | ------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------ |
| Create 1,000       | 29.4 to 23.7, -19.2%, real                        | 28.9 (0.5) to 23.5 (0.3), -18.7%, noise 1.4, real        |                                                          |                                                  |
| Replace 1,000      | 32.9 to 28.9, -12.2%, real                        | 33.3 (0.3) to 31.1 (1.4), -6.7%, noise 4.1, within noise | 34.0 (0.3) to 29.0 (1.3), -14.5%, noise 3.8, real        |                                                  |
| Append 1,000 to 1k | 60.2 to 54.8, -9.0%, within noise (base outliers) | 59.9 (2.6) to 56.1 (1.2), -6.3%, noise 7.9, within noise | 60.0 (1.5) to 55.8 (1.2), -7.0%, noise 4.6, within noise | 59.6 (1.2) to 55.9 (1.0), -6.2%, noise 3.6, real |
| Create 10,000      | 376 to 290, within noise (load)                   | 317.6 (3.2) to 247.3 (4.8), -22.1%, noise 14.5, real     |                                                          |                                                  |

Create and create 10,000 clear the noise by far. Replace clears it in 2 of 3 runs. Append moves 6 to 9% in every run and clears the noise only at 31 runs (3.7 ms gain, 3.6 ms noise): call it a small real gain.

### Size

- Todo loader, the e2e `loaderBudget` measure (gzip -9 of the module script and its static imports): 4004 B before, 4033 B after (+29 B, the fragment branch in `patchList`). Budget 4096 B. No feature flag: every app with a list row that writes a value uses the path.
- Chunks: a cloned chunk copies `clone$`, `putAttr$`, `putText$` and their deps, about 400 B gzip, in place of `attr$`, `text$`, `on$` and the escapes. Rows list chunk 508 to 890 B gzip; todo list chunk 459 to 863 B; dashboard dist list chunks 10.2 to 31.1 kB gzip in total (whole dist 126.1 to 147.0 kB, +17%). A click that loads a cloned chunk fetches about 400 B more. Moving `clone$` into the loader would put about 300 B on every page and break the todo budget, so it stays in the chunks.

## Deviations

- Client-made rows keep their comment markers (`<!--t2-->`, `<!--i-->`). The brief asked for fewer or no markers; that needs per-row node references in the patcher (brumate keeps elements on the row scope), which changes `patchRow`, `readRows` and the differential normalization. The clone already removes the per-row parse and the per-row block walk on insert. Left for `perf-list-kept`.
- Files outside the owned paths: `test/compiler/compile/compile.test.ts` (list rows compared as DOM, `parseHtml$` helper), `test/vite/features.test.ts` (alias `idlip/client` to the loader source; the test built the loader from `src/client/index.ts` with an empty `resolve`, so the list chunk's import was external and the shared-chunk check failed), `packages/idlip/src/core/format.ts` (`ListChunk.render` type), `packages/idlip/src/compiler/CLAUDE.md`, the three example entry servers (fix commit), and `benchmarks/harness/client.mjs`.
- Website docs not changed (another worker owns `website/**`): `getting-started.md`, `reference/client.md` and `reference/server.md` still tell dev pages to load `/@id/idlip/client`, which runs a second loader when a chunk imports `idlip/client`. `reference/client.md` should also say `ListChunk.render` may return a fragment.
- A/B used a new script, `rows-ab.mjs`, not `bench.py`: `bench.py` reads one metric from one command, and each rows sample needs a fresh page per operation on two servers.

## Stubs left

- None.

## Gotchas

- A cloned body must produce the nodes the HTML parses to. `putAttr$` writes `value` and `checked` as attributes (as the HTML does), not properties as `setAttr$` does. An empty text removes its placeholder node, since the HTML has no text node there.
- In dev, any page that loads the loader from a URL other than the one Vite gives `idlip/client` imports runs two loaders once a chunk imports from `idlip/client`. Use an inline `import 'idlip/client'` so `transformIndexHtml` resolves it.
- The loader has 63 B left under the 4096 B budget.
- `test/differential/differential.test.ts:107` has a `tsc` error from `for-key-callback` (`list.key` may be undefined); vitest does not type check, so it passes.

## Proposed learnings

- A cloned row or branch must hold the nodes its HTML parses to, markers included | the patcher and the differential test read client and server rows alike | packages/idlip/src/compiler/view/codegen | yes (differential subject `cloned`)
- A dev page loads the loader with an inline `import 'idlip/client'`, not `src="/@id/idlip/client"` | two URLs make two module instances, and a chunk that imports the loader resumes the page a second time | examples, website docs | yes (hot e2e test)

## Verification

- `pnpm --filter idlip build && pnpm --filter idlip test`: 66 files, 761 passed, 19 skipped.
- e2e (`E2E_PORT=48641 E2E_COUNTERS_PORT=48642 E2E_SUBS_PORT=48643 E2E_HOT_PORT=48644 pnpm -C e2e test`, after `pnpm -r --filter "./examples/*" build`): 18 passed, loader budget included.
- Benchmark apps: `build`, `build:rows`, `build:dashboard`, `build:scale` exit 0. `pnpm -C benchmarks/harness test`: 13 passed.
- `rtk proxy pnpm lint`: no errors in tracked files. `pnpm exec oxfmt --check .`: clean.
- Mutation check: making `putAttr$` write an empty class fails the differential test (5 failures).

## Size

- Estimated L, actual L.
