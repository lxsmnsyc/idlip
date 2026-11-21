# Outcome: safe-urls

## Built

- `packages/idlip/src/core/url.ts`: `isUrlAttr(name)` over the URL attributes (action, background, cite, codebase, data, formaction, href, longdesc, manifest, ping, poster, profile, src, xlink:href).
- `safeUrl$(value, name)` in `packages/idlip/src/core/helpers.ts`: removes control characters and spaces, then drops a value that starts with `javascript:` or `vbscript:` (any case). The attribute is left out and, outside production, `console.warn` says so. Server: `attr$('href', safeUrl$(expr, 'href'))`. Client: `setAttr$(el, 'href', safeUrl$(...))` in the binding chunk. The compiler wraps in `html.ts` and `chunks.ts`. `idlip/server` exports `safeUrl`.
- Static literal rule: a value written in source (`href="javascript:void(0)"`) is not checked and keeps working, since the author wrote it and it is not data. A literal inside braces (`href={'javascript:...'}`) is a bound hole and is dropped. Documented in `core/url.ts`.
- Tests: `test/security/urls.test.ts` with fixture `urls.idlip.tsx` (HTML `<a>`, `form action`, `formaction`, SVG `<a href>` and `xlink:href`; server render and client patch; case, whitespace and control-character variants; vbscript; static literal).

## Proof

- base: `53ff026`, `pnpm --filter idlip exec vitest run test/security`: 2 failed (`href` kept `javascript:alert(1)` on render and after a patch).
- branch: same command: 5 passed.

Loader: todo loader 3881 B gzip -9 as the e2e `loaderBudget` test sums it (budget 4096). The helper lives in chunks, not in the loader, so the loader grows by 0 B. A chunk with a URL attribute carries about 250 B more source.

## Deviations

- `test/security/urls.idlip.tsx` has `@ts-nocheck`: the JSX types lack `formaction` on `<button>` and `xlink:href` on an SVG `<a>` (a `jsx-types` follow-up).
- Edits outside owned and shared paths: `src/core/helpers.ts`, `src/server/helpers.ts`, `src/server/index.ts`, `src/compiler/view/codegen/chunks.ts`.
- `data:` URLs are not blocked, only `javascript:` and `vbscript:`.

## Stubs left

- None.

## Gotchas

- Review fix: an object or array value is dropped (`attr$` would join its keys into a URL). The helper reads `process.env.NODE_ENV`, which Vite replaces in client builds, as `dev.ts` does.
- Not covered: SVG animation targets (`<animate attributeName="href" to=...>`), `srcdoc`, and a spread of attributes (not supported by idlip). Event attributes are already a compile error.
- A new URL attribute needs an entry in `URL_ATTRS`.

## Proposed learnings

- Every attribute that holds a URL goes in `URL_ATTRS` | the compiler wraps only the listed names | packages/idlip/src/core | no

## Verification

- `pnpm --filter idlip test`: 627 passed.
- `pnpm build && E2E_PORT=6973 E2E_COUNTERS_PORT=6974 E2E_SUBS_PORT=6975 E2E_HOT_PORT=6976 pnpm --filter e2e test`: 16 passed.
- `pnpm typecheck`, `pnpm lint`: no errors in changed files (existing warnings elsewhere).

## Size

- Estimated S, actual S.
