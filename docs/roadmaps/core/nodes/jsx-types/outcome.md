# Outcome: jsx-types

## Built

- `packages/idlip/src/jsx/elements.ts`: attribute types and `HtmlElements` (every tag of `HTMLElementTagNameMap`), `GlobalElements` (`window`, `document`). Each element has `on:*` and `latest:*` props for every event in `HTMLElementEventMap`, typed as a function of an event whose `currentTarget` is that element.
- Attributes: `class` (string or record of booleans), `id`, `title`, `ref` (string or tuple), `html` (`TrustedHtml` only), `key`, `children`, `aria-*`, `data-*`, and tag-specific ones for `a`, `button`, `input`, `textarea`, `select`, `option`, `form`, `label`, `img`. Other tags take the common ones.
- `<window>` takes only `on:*` and `latest:*` props from `WindowEventMap`. `<document>` the same from `DocumentEventMap`.
- `packages/idlip/src/jsx-runtime/index.ts` declares its own `JSX` namespace: core `Element`, `ElementChildrenAttribute`, `IntrinsicAttributes`, and `IntrinsicElements` from the types above. It also exports `EventFor`, `EventProp` and `ClassValue`.
- Tests in `packages/idlip/test/jsx/`: `fixture.tsx` (checked by `tsc`, with `@ts-expect-error` cases) and `jsx.test.ts`.
- No `Show`, `Switch` or `Match`. Conditions are plain JSX.

## Deviations

- `IntrinsicElements` in `src/core/jsx.ts` (core-api) stays empty. It is outside this node's paths, so `idlip/jsx-runtime` declares its own namespace that reuses the core types.
- `window` and `document` props use a local `TargetProp` type (same shape as `EventProp`), since `EventProp` needs `El extends Element`.
- The types do not reject `on:x` with `latest:x` on one element. The compiler does (`debates/subscriptions/debate.md`).
- No SVG elements. Not in the brief.
- Event modifier syntax (`modifiers` in view-ir) is not defined here. The brief does not ask for it.

## Stubs left

- None.

## Gotchas

- `on:input` is an `InputEvent` in the installed DOM lib, not `Event`.
- The fixture handlers return `unknown`, because lint forbids an arrow that returns a void call, and the compiler wants an arrow whose body is one handler call.
- Fixture `.tsx` files import `JSX` from `idlip/jsx-runtime` for return types, since there is no global `JSX` namespace.

## Proposed learnings

- Declare test handler stubs as returning `unknown` | lint `no-confusing-void-expression` fires on handler-call arrows | packages/idlip/test | yes

## Verification

- `pnpm --filter idlip exec vitest run test/jsx`: pass.
- `pnpm --filter idlip test`: pass (10 tests).
- `pnpm typecheck`, `pnpm format:check`: pass. `./node_modules/.bin/oxlint --type-aware packages`: clean.
- Acceptance: `on:click={add}` and `on:input` with `e.currentTarget.value` compile; `checked` on a `<button>` fails; `html="<b>"` fails; `html={trusted('<b>')}` compiles. All in `test/jsx/fixture.tsx`.

## Size

- Estimated M, actual M.
