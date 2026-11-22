# Outcome: cloned-templates-all

## Built

Every client body clones a template. The only markup a chunk parses in the browser is the value of `html=`. Commits, in the brief's order, each with the differential test green:

| Step | Commit    | What                                                                                                                                                                                                                         |
| ---- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| fix  | `cd00dfb` | `patchList` skips a list that a branch swap in the same patch rendered from the new model (a crash on the base, with HTML too). Behind the new flag `HAS_INNER_LISTS`.                                                       |
| 1    | `3b7df7c` | Conditions and lists inside rows and branches: marked comments `<!--c<id>:x<n>-->` and `<!--/lx<n>-->`, nested templates, `usage.templates` printed once per chunk, `blocks = true` on a list chunk whose rows hold a block. |
| 2    | `4568129` | Children inside bodies (`<!--n:x<n>-->`, `addChild(..., $doc)` returns nodes) and the child's `view` chunk (`templateV$`).                                                                                                   |
| 3    | `b8fac1b` | SVG and MathML bodies: the template declares `s`, `clone$` parses in the wrapper.                                                                                                                                            |
| 4    | `3422f7b` | A `textarea` or `title` hole sets the element's text; the server and the template write the newline the parser drops after `<pre>`, `<listing>`, `<textarea>`.                                                               |
| 5    | `2b90b40` | Text holes directly in a `select` or a table clone (comments are never moved); text in a `colgroup` is `html-nesting`.                                                                                                       |
| 6    | `f7acd37` | `<Try>` (body in a `try` block, catch view, reset), `<Subscribe>`, `<Head>` (content cloned into `template.content`), global listeners, author `<template>` content; the try chunk's `render` and `region` clone.            |
| 7    | `f5ab5a0` | Dynamic holes print through `track$` in a cloned body.                                                                                                                                                                       |
| 8    | `9958a52` | Static and empty bodies clone (`clone$(t, $doc)[0]`, `createDocumentFragment()`).                                                                                                                                            |
| 9    | `5d0bcdf` | Raw HTML: the element clones, the write appends `...parseHtml($doc, value, ns)`. Every string path removed from `patchList`, `setBranch$`, `addChild`, `errors.ts`; `HtmlBuilder` is the server render only.                 |
| docs | `93a19c5` | Flag costs in `client/CLAUDE.md`.                                                                                                                                                                                            |

- What still parses a string: the value of `html=` only, in two forms: the `a` binding (`el.replaceChildren(...parseHtml(...))`) and a cloned element with raw content (`el.append(...parseHtml($doc, ...))`). `clone$` also parses each template once per document, which is a static string from the compiler, not data.
- The test that enforces it: `packages/idlip/test/compiler/view/codegen/string-render.test.ts`. It compiles the 86 `.tsx` files of the fixtures, differential subjects, examples and benchmark apps, each as a root and as a child, and fails on an import of `text$`, `attr$` or `on$` in a chunk, on any `parseHtml(` that is not one of the two `html=` forms, on a markup string inside a render function, and on a render function that does not clone. Its first case feeds it lines of the old chunks, which it must flag.
- Differential subjects added: `nested-blocks`, `nested-blocks-unmarked`, `cloned-children` (with child `tally.tsx`), `foreign`, `raw-text`, `select-text`, `block-kinds`, `static-bodies`, `raw-content`. Mutation checks: a wrong branch number on the start comment fails 2 tests; a missing slot path on a child's boundary fails 2 tests.
- Change request: `contracts/compiled-format-cloned-templates-all.change-request.md`.
- Docs: `website/docs/reference/client.md`, `compiler/CLAUDE.md` (four rules), `client/CLAUDE.md` (a rule and flag costs).

## Sizes

gzip -9, builds from empty `dist` folders. Loader = the todo example's loader file (the e2e `loaderBudget`).

| Step           | Todo loader | Todo helpers | Counters loader | Dashboard loader | Rows dist | Dashboard dist |
| -------------- | ----------: | -----------: | --------------: | ---------------: | --------: | -------------: |
| base `1450e63` |        4063 |          927 |            5006 |             4858 |      7648 |         103954 |
| fix + 1        |        4073 |          969 |            5016 |             4890 |      7711 |         104462 |
| 2              |        4073 |          969 |            5113 |             4890 |      7711 |         107015 |
| 3 to 8         |        4073 |          969 |            5113 |             4890 |      7711 |         107015 |
| 9              |        4026 |          969 |            4957 |             4842 |      7653 |         106997 |

- Steps 3 to 8 change no loader or helpers code that these apps use (the `errors.ts` change is behind `HAS_ERRORS`).
- Flag-on cost over the 4026 B todo loader: `HAS_CHILDREN` +794 B, `HAS_ERRORS` with `HAS_RETRY` +635 B, `HAS_INNER_LISTS` +20 B.
- Dashboard dist +2.9% over the base: child views and nested rows are template constants plus writes, longer than the HTML strings they replace. The first dashboard click fetches the same 1.4 kB gzip; the todo toggle fetches 1.3 kB instead of 1.2 kB (the list chunk's template).

## Timing

Machine: Apple M2, 8 GB, Chrome 158, Node 26.12.1. Base: `batch/core` 1450e63 builds, copied before any change. Branch: 93a19c5 builds. N fixed before the run, one run each, reported in full. Waited for the 1-minute load to drop under 3 (it was 4.96 and 5.54); the run started at 2.34 3.88 5.02.

Rows, interleaved A/B, `node benchmarks/harness/rows-ab.mjs --dir base=... --dir branch=... --runs 21`, click to paint, ms, median (MAD), noise = 3 x the larger MAD. Load 2.34 at the start, 2.63 at the end.

| Op                 | base        | branch      | Change | Noise | Verdict      |
| ------------------ | ----------- | ----------- | -----: | ----: | ------------ |
| Create 1,000       | 32.4 (3.8)  | 33.4 (2.0)  |  +2.8% |  11.3 | within noise |
| Replace 1,000      | 31.4 (0.6)  | 30.9 (0.7)  |  -1.6% |   2.2 | within noise |
| Append 1,000 to 1k | 57.0 (0.8)  | 56.8 (0.5)  |  -0.3% |   2.4 | within noise |
| Create 10,000      | 252.4 (4.4) | 250.8 (2.8) |  -0.6% |  13.2 | within noise |

Profile, `node benchmarks/harness/profile-rows.mjs idlip <op> 10`, script and native work a round: create 7.7 to 7.3 ms, replace 15.5 to 15.2 ms, append 16.9 to 16.9 ms. The rows page already cloned its rows on the base; the top costs are the same (`importNode`, `setAttribute`, `before`, `clone$`).

Todos and dashboard, `pnpm -C benchmarks/harness bench --scenario todos,dashboard --only idlip --no-build --metrics browser,waterfall`, two pairs alternating base and branch, single sessions (load 3.02 down to 1.64):

| Metric                                               | Base, pair 1 / 2              | Branch, pair 1 / 2            |
| ---------------------------------------------------- | ----------------------------- | ----------------------------- |
| Todos click to update (counter / toggle / add)       | 74 / 65 / 82, 84 / 65 / 82 ms | 89 / 49 / 82, 72 / 50 / 79 ms |
| Todos first click, 150 ms RTT, after idle / cold     | 227 / 222, 247 / 229 ms       | 224 / 226, 243 / 223 ms       |
| Dashboard click to update (widget 1 / 30 / 45)       | 67 / 57 / 48, 79 / 60 / 47 ms | 80 / 54 / 46, 76 / 59 / 47 ms |
| Dashboard first click, 150 ms RTT, after idle / cold | 235 / 243, 241 / 231 ms       | 250 / 252, 236 / 243 ms       |

Every first click stays one round trip with the same requests. The todo toggle (a row through the list chunk) was 65 ms on the base and 49 to 50 ms on the branch in both pairs; the other numbers move both ways between pairs by up to 15 ms. Single sessions, so no claim beyond "nothing got slower": no metric is slower in both pairs.

## Deviations

- Step 5: the brief asked to anchor table and select text on the parent element. A Chromium probe showed the parser never moves comments, so the template's comment mark already holds its place, and a select keeps text, so the clone matches. A `colgroup` moves the server's text (and its end marker) before the table, which no clone can match, so the analyzer now rejects text there as it did in a table: one word in `src/compiler/view/analyze/analyze.ts`, outside the owned paths.
- Step 4: the newline rule changed the server output: a `pre` or `listing` with children starts with a newline, as a `textarea` did. happy-dom keeps that newline and browsers drop it; writing it on both sides is the only form both agree on (a client-side drop failed the differential test).
- Step 7: the plan never puts a dynamic hole in a client body (only at the top of a root view, which renders on the server), so the step removes a refusal; `template.test.ts` checks it with a hand-made plan.
- A `<Head>` binding reads `document.head`, which the model-pair harness leaves out (with HTML too), so `template.test.ts` mounts a branch with a cloned `<Head>` instead of a differential pair.
- Files outside the owned paths: `src/compiler/view/analyze/analyze.ts` (colgroup), `src/compiler/CLAUDE.md`, `src/vite/features.ts` (`INNER_LISTS` detector), `src/testing/index.ts` (`addChild` type), `src/core/format.ts`, `test/compiler/compile/*.test.ts`, `test/core/helpers.test.ts`, `test/svg/svg.test.ts`, `test/vite/features.test.ts`, `website/docs/reference/client.md`.
- No e2e test for the Chromium parser checks: the probe (`playwright-core`, copies of `parseHtml` and `clone$`) ran by hand for `pre`, `textarea`, SVG and MathML namespaces, `select` and `colgroup`; the existing e2e suite runs cloned rows, branches, children and subscriptions in Chromium.

## Stubs left

- None.

## Gotchas

- `clone$` reads a comment whose data ends in `x<n>` as a mark and keeps the data before it. A static comment in a template must not end that way; the compiler writes none.
- The textarea write appends (`textContent +=`) to what the parser kept of the template's newline.
- Bugs found, not fixed: `diffPaths` reads `.length` of a string as `undefined` (`readField` takes records only), so a hole that reads `row.label.length` never patches, with either render path.
- `benchmarks/results/*` files are written by the harness and ignored by git.

## Proposed learnings

- Every client render returns a cloned node; only `html=` content is parsed | string paths cost loader bytes and a parse per row | packages/idlip/src/compiler/view/codegen, packages/idlip/src/client | yes (`string-render.test.ts`)
- Where parsers disagree (happy-dom vs browsers on the newline after `<pre>`), write the input on both sides so the parser's rule cancels out | a client-side emulation passes one parser and fails the other | packages/idlip/src/compiler/view/codegen | yes (differential `raw-text`)
- A patch must skip a list that a branch swap in the same patch rendered | its binding diffs the old items against new rows | packages/idlip/src/client | yes (`fresh-list.test.ts`)

## Verification

- `pnpm --filter idlip build && pnpm --filter idlip test`: 70 files, 805 passed, 28 skipped. `tsc --noEmit` in `packages/idlip`: clean.
- `pnpm --filter website build` (28 pages), `test` (109 passed), `check:samples` (49 samples, 42 live, 0 problems).
- e2e after `pnpm -r --filter "./examples/*" build`, ports 48661 to 48664: 24 passed, loader budget included.
- Benchmark apps `build`, `build:rows`, `build:dashboard`, `build:scale`: exit 0. `pnpm -C benchmarks/harness test`: 13 passed.
- `rtk proxy pnpm lint`: no errors. `pnpm exec oxfmt --check .`: clean.

## Size

- Estimated L, actual L.
