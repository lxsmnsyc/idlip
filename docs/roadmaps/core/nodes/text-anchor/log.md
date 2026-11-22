# Log: text-anchor

- 2026-11-23: branched `node/text-anchor` from `batch/core`, rebased onto `c98aa59`/`9d2569d` after `fix-for-prop-each` landed (nothing committed yet then).
- Read brumate `9317783c`: brumate adds `plan.contents` and a `content()` runtime call. idlip needs neither: the loader indexes `i-a` ids as `a<id>`, and `setText$` already sets an element's text when given an element (textarea path). So the binding is named `a<id>` and the client does not change.
- Rule: `getFilledHole(node)` in `plan.ts`: the element has exactly one child, a text hole, and the tag is not `script`, `style`, `textarea`, `title`, `pre`, `listing`. If `bindHole` binds it (kind `a`, source `text`), its id goes last in the element's `i-a` and into `plan.filled`. Unbound holes are unchanged (they had no markers).
- `html.ts` and `template.ts` drop the markers for `plan.filled` and use `a<id>` as the tracked name of a dynamic hole.
- Goldens: `UPDATE_TRY`, `UPDATE_NESTED`, and a scratch regex script for `page.html`, `server.js`, `manifest.json` of counter, effects, nested and try (board's own `t0` has a sibling and stays). Hand fixes in a few unit expectations.
- Mutation checks: writing markers in the clone for filled holes fails 29 differential tests. Letting `pre` fill does not fail in happy-dom (it keeps the leading newline, and `compare.ts` drops it on both sides), so `pre`/`listing` stay excluded on the Chromium finding of `cloned-templates-all`; `text-anchor.test.ts` asserts the `pre` keeps its markers.
- Sizes measured with a scratch script (`loadApp` of the harness, `zlib.gzipSync` level 9) before and after, same machine, fresh builds. todos-0 raw is equal and gzip +1 B: the diff is only the build hashes and `"t3"` to `"a3"` in the manifest; the page has no filled hole without todos.
- Loader: `examples/todo` loader file has the same hash as before (`loader.Cb6Kgl1g.js`), 9907 B, 3991 B gzip.
- Timing: rows A/B, 9 runs, load 2.66 at the start and 2.19 at the end. All six operations within noise.
