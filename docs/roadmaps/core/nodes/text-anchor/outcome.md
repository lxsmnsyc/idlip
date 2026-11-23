# Outcome: text-anchor

## Result

A bound text hole that is the only child of its element writes no `<!--tN-->…<!--/t-->` markers, on the server and in cloned templates. The element's `i-a` lists the hole id last, the binding is `a<id>`, and `setText$` sets the element's text. Kept.

Rule (`getFilledHole` in `compiler/view/codegen/plan.ts`, `plan.filled`): the element has exactly one child, a text hole that gets a binding, and the tag is not `script`, `style`, `textarea`, `title` (text is not markup), `pre` or `listing` (the parser drops a leading newline that a clone or patch would keep). A hole with any sibling, static text included, keeps its markers.

## Built

- `plan.ts`: `getFilledHole`, `UNFILLED_TAGS`, `Plan.filled`; the element case binds the hole as `a` and adds it to the element's anchors.
- `html.ts`, `template.ts`: no markers for a filled hole; a dynamic filled hole records its reads under `a<id>`.
- No client change: the loader indexes `i-a` as `a<id>`, `setText$` already handles an element, row node maps read `i-a`.
- Tests: `test/compiler/view/codegen/text-anchor.test.ts` (markup, names, a mounted patch with new rows); differential subject `text-anchor` (top level, attribute and event on the same element, branch, select option, rows, SVG, empty values, `pre` and a sibling hole kept). Goldens of counter, effects, nested and try rewritten.
- `contracts/compiled-format-text-anchor.change-request.md`; `compiler/CLAUDE.md` rule; one sentence in `website/docs/resuming.md`.

## Numbers

SSR HTML, bytes, raw / gzip -9 (`zlib.gzipSync` level 9), fresh builds of `benchmarks/idlip`:

| Page        | Before         | After          | Change        |
| ----------- | -------------- | -------------- | ------------- |
| todos, 0    | 4908 / 2044    | 4908 / 2045    | 0 / +1        |
| todos, 3    | 5430 / 2164    | 5382 / 2160    | -48 / -4      |
| todos, 100  | 22720 / 3498   | 21120 / 3479   | -1600 / -19   |
| rows, 1,000 | 362089 / 24331 | 336089 / 23928 | -26000 / -403 |
| dashboard   | 99887 / 8739   | 95887 / 8587   | -4000 / -152  |

todos-0 has no filled hole; its +1 B gzip comes from new build hashes and `"t3"` to `"a3"` in the manifest. Per todo: 16 B raw. Per row: 26 B raw.

Loader: unchanged file (`loader.Cb6Kgl1g.js`, same hash), 9907 B, 3991 B gzip. No flag needed.

Timing, `rows-ab.mjs`, 9 runs, load 2.66 to 2.19, paint ms (base / branch): create1k 35.3 / 34.0, replace1k 31.5 / 31.1, update10th 15.9 / 16.1, append1k 57.2 / 57.7, select 15.4 / 15.5, remove 15.6 / 15.5. All within noise.

## Verification

`pnpm --filter idlip build && test` 842 passed; tsc clean; website build, test (135) and `check:samples` (49 samples, 0 problems); examples build and e2e 27 passed (todo spec and loader budget included); benchmark builds (todos, rows, dashboard, scale); harness tests 16 passed; lint exit 0 (existing warnings); oxfmt clean.

## Left

- happy-dom cannot show the `pre` newline case; the exclusion rests on the Chromium probe of `cloned-templates-all`.
- Brumate's other two parts of `9317783c` (a list item marked by its single root element, handler elements without `data-b`) are not in this node.
