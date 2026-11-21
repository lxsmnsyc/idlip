# Log: safe-urls-2

## Proof on the base

Base `batch/core` at `97c3fea`, with the new tests (`packages/idlip/test/security/gaps.test.ts`, fixture `gaps.idlip.tsx`) added and the source unchanged.

- `pnpm --filter idlip exec vitest run test/security/gaps.test.ts`: 6 failed, 3 passed.
  - animation, server render and patch: `#to to` kept `javascript:alert(1)`.
  - embeds, server render and patch: `#iframe src` kept `data:text/html,<script>...`.
  - srcdoc: no `srcdoc-trusted` error for `srcdoc={props.s}`; `trusted(...)` failed only because the attribute was not unwrapped.
  - passed on base, as guards: a non-URL animation attribute keeps its value, `img src` keeps `data:`, a literal srcdoc compiles.
- Types: on the base `elements.ts` with `@ts-nocheck` removed, `pnpm --filter idlip typecheck` gave 5 errors (`formaction` on button, `xlink:href` on `<a>`, and `src`/`data` on iframe, object and embed in the new fixture).

All three gaps reproduced.

## Notes

- The element decides the check, so the analyzer sets `url` on each bound attribute (`getUrlKind` in `core/url.ts`). Chunks and the server pass `embed` as a third argument of `safeUrl$` when it is `embed`.
- An animation whose `attributeName` is bound checks `to`, `from`, `by` and `values` too, since the target is unknown.
- `data:image/svg+xml` is not allowed in embeds: an SVG document runs scripts.
