# Outcome: safe-urls-2

## Built

- `getUrlKind(tag, name, target)` and `UrlKind` in `packages/idlip/src/core/url.ts`. The analyzer sets `Attr.url` (`ir.ts`) on each bound attribute, `plan.ts` carries it to the binding source, and `html.ts` and `chunks.ts` wrap with `safeUrl$(value, name[, true])` when it is set.
- SVG animation targets: on `<animate>` and `<set>`, `to`, `from`, `by` and `values` are URL attributes when the static `attributeName` is a URL attribute (any case). A bound `attributeName` makes all four URL attributes. `values` is checked per `;` part.
- `data:` in `iframe src`, `object data` and `embed src` is dropped, except `data:image/` png, gif, jpeg, webp, avif and bmp. `data:image/svg+xml` is dropped since an SVG document runs scripts.
- `srcdoc`: a bound value must be `trusted(value)` from idlip (unwrapped, written as an escaped attribute). Anything else is the compile error `srcdoc-trusted`. A literal in source is allowed, as for other attributes. `lowerTrusted` in `analyze.ts` is shared with `html=`.
- JSX types in `src/jsx/elements.ts`: `formaction` on `<button>`, `xlink:href` on `<a>`, and new `iframe` (`src`, `srcdoc`), `object` and `embed` entries. `@ts-nocheck` is gone from `test/security/urls.idlip.tsx`.
- Tests: `test/security/gaps.test.ts` with fixture `gaps.idlip.tsx`.

## Proof

Animation targets, embedded `data:`, `srcdoc`:

- base: `97c3fea` plus the new tests, `pnpm --filter idlip exec vitest run test/security/gaps.test.ts`: 6 failed, 3 passed (`#to to` kept `javascript:alert(1)`, `#iframe src` kept `data:text/html,...`, no `srcdoc-trusted` error).
- branch: same command: 9 passed.

JSX types:

- base: `elements.ts` of `97c3fea` with `@ts-nocheck` removed, `pnpm --filter idlip typecheck`: 5 errors.
- branch: `pnpm typecheck`: no errors.

Loader: todo loader 3881 B gzip -9 as the e2e `loaderBudget` test sums it (budget 4096), the same as before. The helper lives in chunks, so the loader grows by 0 B.

## Deviations

- Edits outside owned and shared paths: `src/compiler/view/analyze/analyze.ts`, `src/compiler/view/analyze/ir.ts`, `src/compiler/view/codegen/plan.ts`, `src/compiler/view/codegen/chunks.ts`, `src/core/helpers.ts`. The element tag is not known to `safeUrl$`, so the analyzer decides.
- Added `iframe`, `object` and `embed` JSX types beyond the two named in the brief, since the fixture needs them.

## Stubs left

- None.

## Gotchas

- A new element-specific URL case goes in `getUrlKind`, a new plain URL attribute in `URL_ATTRS`.
- happy-dom logs "Iframe page loading is disabled" to stderr in the tests. It does not fail them.
- Not covered: `data:` in `<a href>` and `<form action>`, and `srcdoc` on a bound spread (unsupported).

## Proposed learnings

- A value that a browser runs as a document or script goes through `safeUrl$` or `trusted(...)` | the compiler wraps by element and attribute, so a new loading element needs a case | packages/idlip/src/core | no

## Verification

- `pnpm --filter idlip test`: 657 passed.
- `pnpm build && E2E_PORT=7873 E2E_COUNTERS_PORT=7874 E2E_SUBS_PORT=7875 E2E_HOT_PORT=7876 pnpm --filter e2e test`: 16 passed.
- `pnpm build && pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`: all pass (lint warnings elsewhere only), 657 tests.

## Size

- Estimated S, actual S.
