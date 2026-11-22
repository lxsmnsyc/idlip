# Outcome: cloned-templates

## Built

- `packages/idlip/src/compiler/view/codegen/template.ts`: `canClone(nodes, namespace, component, plan)`, `buildClone(...)`, `printTemplate(...)`, `printClone(name, body)`. A client row or condition branch of elements, static text and text holes, with at least one write, compiles to a static template HTML and a list of writes. `i-x="<n>"` marks a written element and `<!--x<n>-->` a text hole.
- `packages/idlip/src/core/helpers.ts`: copied helpers `clone$(template, doc)` (parses the template once per document through the loader's `parseHtml`, keeps the result in a `WeakMap` keyed by document, swaps each `<!--x<n>-->` for a text node, keeps the child path of each mark and throws when the parse found fewer marks than the template's `n`; per render `doc.importNode` plus the path walk), `putAttr$` (writes an attribute as `attr$` would have in the HTML), `putText$` (removes the node for an empty text). `setBranch$` takes a string or a node and passes `start.ownerDocument` to the render function.
- `chunks.ts`: the list chunk declares `const template$ = { h: '<!--i-->...<!--/i-->', n: <marks> }` and `render(scope, $doc)` returns the fragment. A condition chunk declares `templateC<id>_<branch>$` per cloned branch, and its render function takes `(branch, $doc, scope)`.
- `client/list/index.ts`: `patchList` calls `render(scope, start.ownerDocument)`, inserts a fragment as is and does not walk it for blocks. `ListChunk.render` returns `string | DocumentFragment` (`core/format.ts`).
- The clone holds the same nodes the HTML parses to, row and `<!--t-->` markers included. Client-made rows keep their markers, so `patchRow`, `readRows` and `findNode` need no change, and the differential normalization did not change.
- Tests: differential subject `cloned` (holes next to static text, empty text, class objects, boolean, URL and form attributes, event messages that read the row, rows in a `<tbody>`, a disclosure with both branches cloned); `test/compiler/view/codegen/template.test.ts` (a disclosure branch renders through a clone, opened and closed by clicks; row chunk shape; fallbacks); list chunk tests compare rows as DOM through `test/fixtures/rows.ts`.
- `benchmarks/harness/rows-ab.mjs`: interleaved A/B of rows operations between two copied `dist/` folders. `client.mjs` exports `measureOperation`.
- Change request: `contracts/compiled-format.v16.change-request.md`.
- Separate fix commit in the Vite plugin: dev pages load `/@id/idlip/client` while chunks import the resolved `/@fs/.../dist/client/index.js`, so a chunk that imports the loader ran a second copy of it (and a second `createPolicy('idlip')` under Trusted Types would throw). The hot e2e test failed once list chunks imported `parseHtml`. A dev middleware now serves `/@id/idlip/client` as a proxy module `import 'idlip/client';`, which resolves to the URL chunks get (`test/vite/dev-loader.test.ts`; the hot e2e test covers the examples). Docs updated: `getting-started.md`, `reference/client.md` (also: `render` may return a fragment). `reference/server.md` keeps the `/@id/idlip/client` form, which is now safe.

## What falls back to HTML strings

Children, nested `<For>` and conditions inside the body, `<Try>`, `<Subscribe>`, `<Head>`, global listeners (`<template i-global>`), `html=` raw HTML, any write inside a `<template>` element (the walk does not enter template content), holes in `script`/`style`/`textarea`/`title`, text holes directly under `table`/`thead`/`tbody`/`tfoot`/`tr`/`colgroup`/`select` (the parser moves text there) or `pre`/`listing` (it drops a leading newline), bodies inside `<svg>` or `<math>` (`namespace` not `html`; inline SVG inside an HTML row clones), empty bodies, and bodies with no write: no hole, no bound attribute or keyed ref, and only event messages fixed at build time (a static body parses quickly and `clone$` would cost more bytes). Dynamic holes (`track$`) also fall back, but the plan never makes one inside a row or a block (`plan.ts`, "Rows, blocks and children render from templates that record no reads"). The compiler already rejects a text hole in a `<tr>` (`html-nesting`) and in a `<textarea>` (`codegen-raw-text`). The server render and the view chunk do not change.

## Proof

Machine: Apple M2, 8 GB, Chrome 158, Node 26.12.1.

### Profile: where create time goes

`node benchmarks/harness/profile-rows.mjs idlip <op> 10` on unminified builds of the pre-review code (base `batch/core` 25f491a), load average 2.6 to 3.2. Script and native work a round, ms (self time of the top entries). The review changes to `clone$` (document argument, `WeakMap` lookup, mark count) were profiled once more, but the load rose to 33 during that run, so those numbers (create 38.0 to 18.4, replace 54.0 to 31.2, append 60.8 to 18.8) show the same split and are not used.

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

Tool: `node benchmarks/harness/rows-ab.mjs --dir base=<base rows dist> --dir branch=<branch rows dist> --runs 21`, click to paint, ms, median (MAD). Noise is 3 x the larger MAD. Base: `batch/core` fb78915 (`packages/idlip/src` checked out from it, rows app built). Branch: 968e48a. N = 21 for all four operations was fixed before the run, and both runs are reported in full.

Run A, the valid run. The 1-minute load average was under 3 at the start (2.99 9.61 9.37) and 3.20 5.70 7.60 at the end:

| Op                 | base        | branch      | Change | Noise | Verdict                |
| ------------------ | ----------- | ----------- | ------ | ----- | ---------------------- |
| Create 1,000       | 38.0 (0.8)  | 35.4 (2.0)  | -6.7%  | 5.9   | not shown beyond noise |
| Replace 1,000      | 34.3 (1.5)  | 32.3 (1.9)  | -5.9%  | 5.7   | not shown beyond noise |
| Append 1,000 to 1k | 67.1 (1.0)  | 57.2 (0.8)  | -14.7% | 3.0   | real                   |
| Create 10,000      | 319.8 (6.4) | 250.5 (3.2) | -21.7% | 19.2  | real                   |

The create 1,000 samples are bimodal on both sides (base 30 and 38, branch 25 and 36 ms): the 5-minute load average was still 9.6 when the run started.

Run B, invalid. It started at 1.75 2.97 4.83 and other work on the machine pushed the load to 33 by the end: create 1,000 38.2 to 29.8 (-22%, noise 12.4), replace 36.9 to 30.3 (-18%, noise 7.4), append 72.2 to 62.6 (-13%, noise 16.3), create 10,000 821 to 578 (-30%, noise 18.7). Every change points the same way, but only create 10,000 clears the noise, and the absolute numbers are not comparable with run A.

Earlier runs on the pre-review build (same harness, N chosen per run, reported here for completeness and not used for the verdict): create 1,000 -18.7% and -19.2% (real both times, base 28.9 to 29.4 ms with the machine quiet), replace -12.2%, -6.7%, -14.5%, append -9.0%, -6.3%, -7.0%, -6.2%, create 10,000 -22.1%.

Verdict: create 10,000 and append are faster beyond noise in the pre-declared run. Create 1,000 and replace are not shown beyond noise in that run, although the script profile halves the create script (15.0 to 7.6 ms) and earlier quiet runs showed -19% on create 1,000. To rerun on a quiet machine (both the 1- and 5-minute load under 3):

```bash
pnpm --filter idlip build && rm -rf benchmarks/idlip/rows/dist && pnpm -C benchmarks/idlip build:rows
cp -R benchmarks/idlip/rows/dist <branch dir>/   # and the same from batch/core into <base dir>
node benchmarks/harness/rows-ab.mjs --dir base=<base dir> --dir branch=<branch dir> --runs 21
```

### Size

- Todo loader, the e2e `loaderBudget` measure (gzip -9 of the module script and its static imports): 4004 B before, 4035 B after (+31 B: the fragment branch in `patchList` and the document argument). Budget 4096 B. No feature flag: every app with a list row that writes a value uses the path.
- Chunks: a cloned chunk copies `clone$`, `isElement$`, `putAttr$`, `putText$` and their deps, about 450 to 500 B gzip, in place of `attr$`, `text$`, `on$` and the escapes. Rows list chunk 508 to 984 B gzip; todo list chunk 459 to 927 B; dashboard dist list chunks 10.2 to 34.6 kB gzip in total (whole dist 126.1 to 150.4 kB, +19%). A click that loads a cloned chunk fetches about 450 B more. Moving `clone$` into the loader would put about 300 B on every page and break the todo budget, so it stays in the chunks. The coordinator accepted this cost because `shared-helpers` lands before 0.1 and removes the duplication.

## Deviations

- Client-made rows keep their comment markers (`<!--t2-->`, `<!--i-->`). The brief asked for fewer or no markers; that needs per-row node references in the patcher (brumate keeps elements on the row scope), which changes `patchRow`, `readRows` and the differential normalization. The clone already removes the per-row parse and the per-row block walk on insert. Left for `perf-list-kept`.
- Files outside the owned paths: `test/compiler/compile/compile.test.ts` (list rows compared as DOM, `parseHtml$` helper), `test/vite/features.test.ts` (alias `idlip/client` to the loader source; the test built the loader from `src/client/index.ts` with an empty `resolve`, so the list chunk's import was external and the shared-chunk check failed), `packages/idlip/src/core/format.ts` (`ListChunk.render` type), `packages/idlip/src/compiler/CLAUDE.md`, `packages/idlip/src/compiler/view/codegen/events.ts` (`isFixedMessage`), `packages/idlip/src/vite/plugin.ts`, and `benchmarks/harness/client.mjs`. The earlier example-server fix was dropped in favor of the plugin fix.
- Website docs changed at the coordinator's request: `getting-started.md` and `reference/client.md`.
- `packages/idlip/src/vite/plugin.ts` (dev middleware and proxy module) is outside the owned paths; the coordinator asked for the fix there.
- A/B used a new script, `rows-ab.mjs`, not `bench.py`: `bench.py` reads one metric from one command, and each rows sample needs a fresh page per operation on two servers.

## Stubs left

- None.

## Gotchas

- A cloned body must produce the nodes the HTML parses to. `putAttr$` writes `value` and `checked` as attributes (as the HTML does), not properties as `setAttr$` does. An empty text removes its placeholder node, since the HTML has no text node there.
- In dev, a page that loads the loader from a URL other than `/@id/idlip/client` or the URL Vite gives `idlip/client` imports runs two loaders once a chunk imports from `idlip/client`. The plugin maps `/@id/idlip/client` only; a custom `client` entry (such as the rows benchmark's `/src/loader.ts`) imports `idlip/client` itself and is fine.
- The differential comparison reads attributes into a map and compares them by name (`src/testing/compare.ts`, `takeSnapshots` and `findDifference`), so a clone that sets attributes in another order than the HTML compares equal. It does not read `<template>` content (`childNodes` of a template element are empty).
- The loader has 61 B left under the 4096 B budget.

## Proposed learnings

- A cloned row or branch must hold the nodes its HTML parses to, markers included | the patcher and the differential test read client and server rows alike | packages/idlip/src/compiler/view/codegen | yes (differential subject `cloned`)
- One URL for the loader in dev: the plugin serves `/@id/idlip/client` as a proxy of the URL chunks import | the browser keys modules by URL, and a second loader resumes the page again | packages/idlip/src/vite | yes (`test/vite/dev-loader.test.ts`, hot e2e test)

## Verification

- `pnpm --filter idlip build && pnpm --filter idlip test`: 67 files, 773 passed, 19 skipped. `tsc --noEmit` in `packages/idlip`: clean after the rebase.
- e2e (`E2E_PORT=48641 E2E_COUNTERS_PORT=48642 E2E_SUBS_PORT=48643 E2E_HOT_PORT=48644 pnpm -C e2e test`, after `pnpm -r --filter "./examples/*" build`): 18 passed, loader budget included.
- Benchmark apps: `build`, `build:rows`, `build:dashboard`, `build:scale` exit 0. `pnpm -C benchmarks/harness test`: 13 passed.
- `rtk proxy pnpm lint`: no errors. `pnpm exec oxfmt --check .`: clean. Website `test` 109 passed, `check:samples` 49 samples, 0 problems.
- Mutation check: making `putAttr$` write an empty class fails the differential test (5 failures).

## Size

- Estimated L, actual L.
