# Outcome: svg-and-html

## Built

- Raw HTML. `html={trusted(value)}` now generates code. Server: `packages/idlip/src/compiler/view/codegen/raw.ts` (`addRawHtml`) writes the value as the element's content, unescaped, with no markers. Client: `printHtmlBody` emits a binding `a<id>` that calls `el.replaceChildren(...parseHtml(el.ownerDocument, value, ns))`. `parseHtml` is the loader's own export and holds the one `idlip` Trusted Types policy. `ns` is the namespace of the element's content (none for HTML and `foreignObject`).
- `plan.ts`: source kind `html`, bound like an attribute (`bindHole`, so a value with no state path renders once). `html.ts`: `addElement` calls `addRawHtml` and writes no children. `chunks.ts`: one `case 'html'`.
- Security. Only a value built with `trusted(...)` imported from `idlip` reaches the binding: the analysis reports `html-trusted` for anything else (a plain string, a string literal, a local function named `trusted`) and `html-children` for children next to `html`. The types agree: `html` takes `TrustedHtml`. Tests: `test/raw-html/raw-html.test.ts` and the type test `test/raw-html/types.tsx` (checked by `pnpm typecheck`).
- JSX types for SVG and MathML (`SvgElements`, `MathElements` in `src/jsx/elements.ts`, wired in `src/jsx-runtime/index.ts`). They were missing, so `<svg>` did not typecheck. Elements take any attribute, the common ones and `on:*`, and `html` stays `TrustedHtml`.
- Namespaces proven: server markup, list rows and condition branches inside `<svg>` get the SVG namespace on the client, a `<foreignObject>` returns children to HTML (`test/svg/svg.test.ts`, fixture `test/fixtures/svg/svg.idlip.tsx`). MathML: the list chunk exports `namespace = 'mathml'` and `parseHtml` wraps in `<math>`, tested. happy-dom does not parse MathML (it puts `<math>` children in the HTML namespace), so the namespace itself was checked in Chromium with a scratch script: `template.innerHTML = '<math><mi>x</mi></math>'` gives the MathML namespace, `<svg><circle/>` the SVG one.
- Change request: `contracts/compiled-format-html.change-request.md` (the binding is `a<id>`, not `h<id>`).

## Proof

Loader gzip -9 (todo build, one file, e2e `loaderBudget` 3900): 3900 B on this branch. The branch changes no loader code, so the growth from this node is 0 B, against the 5 B allowed. Flag-on cost is also 0 B: the binding uses `parseHtml`, which the loader already exports for `setBranch` and lists.

## Deviations

- No `HAS_HTML` flag and no `client/html.ts`. The brief expected a new loader setter behind a flag. The setter is a chunk-side call of `parseHtml`, so the loader holds nothing new and a flag would save nothing. The brief's owned file `packages/idlip/src/client/html.ts` is not created.
- The binding export is `a<id>`, not `h<id>`, since the loader indexes elements by `i-a` (see the change request).
- `<Try>` catch views: the IR `try` node now has `namespace` (set in `analyze.ts`), and the `try=<id>` chunk exports `namespace` when it is not HTML, as list chunks do. The client loader does not consume the `try` chunk on this base, so the loader must pass the export to `parseHtml` when it renders a catch view.
- Edits outside the owned and shared paths: `src/jsx/elements.ts` and `src/jsx-runtime/index.ts` (SVG and MathML JSX types, appended; a `jsx-types` follow-up may refine the attribute types).

## Review fixes

- Plain `on*` attribute names (`onload`) are the compile error `attr-event`, and the SVG and MathML types reject them. Events go through `on:*`.
- `html` needs the `trusted` export of `idlip`, under any local name. `import { For as trusted }` is `html-trusted`.
- `html` on `<script>`, `<style>`, `<textarea>`, `<title>` and `<noscript>` is the compile error `html-element`.
- `trusted` documents that it does no sanitizing.
- Not done, as asked: `javascript:` URLs in `href` and `xlink:href`.

## Stubs left

- None.

## Gotchas

- happy-dom cannot test MathML namespaces. Use Chromium (e2e) for that.
- The server writes `(value) ?? ''` for a raw value, not `getText`, since `idlip/server` does not export `getText`.
- `trusted(...)` unwraps at compile time. The value is whatever the hole evaluates to, so an escape of untrusted input stays the author's job.

## Proposed learnings

- Reach `innerHTML` only through `parseHtml` | it holds the one Trusted Types policy and the namespace wrapper | packages/idlip/src/client | no

## Verification

- `pnpm --filter idlip test`: 611 passed. `pnpm --filter idlip exec tsc --noEmit`: clean.
- `pnpm build && E2E_PORT=5373 E2E_COUNTERS_PORT=5374 E2E_SUBS_PORT=5375 pnpm --filter e2e test`: 14 passed, loader 3900 B.
- `pnpm lint` (no errors), `pnpm format:check`, `pnpm typecheck`: clean.

## Size

- Estimated S, actual S.
