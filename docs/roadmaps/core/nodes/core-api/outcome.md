# Outcome: core-api

## Built

- `packages/idlip/src/core/`: `blocks.ts` (`For`, `Try`, `Head`, `Subscribe`, all throw when called), `trusted.ts` (`trusted`, `TrustedHtml`), `events.ts` (`EventFor`, `EventProp`), `jsx.ts` (`JSX` namespace with `Element`, `ElementChildrenAttribute`, `IntrinsicAttributes`, an empty `IntrinsicElements`), `format.ts` (`Message` as `{ t, p }`, internal), `index.ts`.
- `idlip` (`src/index.ts`) exports `For`, `Try`, `Head`, `Subscribe`, `trusted` and type `TrustedHtml`. The old `createMessage`, `createConstructors`, `defineModule` and constructor types are deleted, with `test/messages.test.ts`.
- Entries `src/{server,client,compiler,vite}/index.ts` (empty, doc block) and `src/jsx-runtime/index.ts` (type exports: `JSX`, `EventFor`, `EventProp`). `package.json` `exports` and `tsdown.config.ts` list all six. `pnpm build` emits all six.
- Dependencies installed: `seroval`, `oxc-parser` (dependencies); `vite` (dev and optional peer `>=7`), `fast-check`, `happy-dom`, `@oxc-project/types` (dev). Lockfile updated.
- Config: `pnpm-workspace.yaml` adds `examples/*` and `e2e`. Root `build` and `test` cover `examples/*`; `e2e` script added (`typecheck` already ran `pnpm -r`). `tsconfig.json` has `jsx: preserve`, `jsxImportSource: idlip` and `paths` for `idlip` and `idlip/*` into `src`. `vitest.config.ts` includes `test/**/*.test.{ts,tsx}`. `oxfmt.config.ts` and `oxlint.config.ts` ignore `packages/idlip/test/fixtures/**/expected/**`. tsdown marks `vite`, `oxc-parser`, `seroval` as never-bundled.
- Tests in `packages/idlip/test/core/`: `api.test.ts` (runtime and `expectTypeOf`), `todo.tsx` (the 0002 todo component plus `@ts-expect-error` cases: `toggle(1)`, missing prop, bad `For` key, `e.currentTarget` element type, TS2367 on `let x: T = v`, wrong `satisfies` initial value), `jsx/jsx-runtime.ts` (a test-only JSX runtime with a few intrinsic elements, used through `/** @jsxImportSource ./jsx */`).

## Deviations

- The brief says to update `contracts/core-api.md` and set `status: frozen`. The edit was blocked by the permission classifier, since the roadmap rules say workers do not edit contracts. The contract is unchanged. The orchestrator should apply this (version 7, `status: frozen`):
  - `jsx-runtime` exports the types `JSX`, `EventFor`, `EventProp`; `IntrinsicElements` is empty until `jsx-types`.
  - `Random`, `Time`, `until` and `Dom` are not exported from `idlip` yet. Their nodes add their own export line to `src/index.ts`.
  - The Stub section is done: the old exports and test are deleted, `Message` is in `src/core/format.ts`.
- `Try`, `Head` and `Subscribe` are exported now (as throwing stubs), not only reserved, since they are compile-time block components like `For`.

## Stubs left

- `IntrinsicElements` in `src/core/jsx.ts` is empty. `jsx-types` fills it. If it declares the same keys as the test-only `test/core/jsx/jsx-runtime.ts`, there is no clash, because the tests use their own namespace.
- `src/{server,client,compiler,vite}/index.ts` are empty.

## Gotchas

- `test/core/todo.tsx` is checked by `tsc` only and never runs. Import it with `import type`.
- `jsx-runtime` has no runtime exports (`jsx`, `jsxs`, `Fragment`), since the compiler replaces views. Vitest cannot run `.tsx` files that import `idlip/jsx-runtime` until a node adds them or aliases it.
- `expectTypeOf(...).toEqualTypeOf<HTMLInputElement>()` fails on DOM types (deep comparison). Use `toExtend`.
- `pnpm lint` at the repo root prints "ESLint output (JSON parse failed ...)" and exits 1, and `oxlint --type-aware` reports errors in `docs/roadmaps/core/debates/subscriptions/evidence/*.tsx`. Both are on the base branch, not from this node. Files under `packages/` lint clean (`pnpm oxlint --type-aware packages`). Someone should add `docs/**` to `ignorePatterns` in `oxlint.config.ts` and look at the JSON error.
- tsdown warns that `external` is deprecated, so the config uses `deps.neverBundle`.

## Proposed learnings

- Type-only fixtures that hold `@ts-expect-error` cases go in `test/**/*.tsx` and are imported with `import type` | they type-check without a runtime JSX | packages/idlip/test | no

## Verification

- `pnpm --filter idlip test`: pass (7 tests).
- `pnpm --filter idlip exec vitest run test/core`: pass.
- `pnpm typecheck`, `pnpm build`, `pnpm format:check`: pass. `pnpm oxlint --type-aware packages`: clean.

## Size

- Estimated M, actual M.
