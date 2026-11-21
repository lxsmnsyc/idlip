# Log: safe-urls

## Proof of the bug

- Base: `53ff026` (batch/core). Command: `pnpm --filter idlip exec vitest run test/security` (the new test and fixture only, no source change).
- Result: 2 failed. Server render and client patch both leave `href="javascript:alert(1)"` on the HTML `<a>` (first assertion), so the bug reproduces.

## Decisions

- One helper `safeUrl$(value, name)` in `core/helpers.ts`, copied into chunks like the other helpers and exported from `idlip/server`. The compiler wraps a bound value of an attribute listed in `core/url.ts` (`isUrlAttr`). Static values are not wrapped.
- Dropping the attribute (return `undefined`) is the replacement. Dev warning behind `process.env.NODE_ENV !== 'production'`.
- `data:` is not blocked: browsers refuse top-level `data:` navigation, and images and iframes need it.
