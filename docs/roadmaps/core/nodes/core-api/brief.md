---
id: core-api
title: Freeze the public runtime surface and the package layout
status: done
priority: must
type: contract
story:
early: false
outline: false
milestone: todo-resumes
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter idlip exec vitest run test/core
exclusive: []
fulfilled_by:
gate: true
added:
spent: 151809
owns:
  - pnpm-workspace.yaml
  - package.json
  - oxfmt.config.ts
  - oxlint.config.ts
  - packages/idlip/tsconfig.json
  - packages/idlip/vitest.config.ts
  - packages/idlip/src/index.ts
  - packages/idlip/src/core/**
  - packages/idlip/package.json
  - packages/idlip/tsdown.config.ts
  - packages/idlip/src/*/index.ts
  - packages/idlip/test/core/**
shared:
  - pnpm-lock.yaml
reserves: []
provides:
  - core-api
depends_on: []
---

# Freeze the public runtime surface and the package layout

## Goal

Freeze the public surface every other node builds on: the runtime exports of `idlip` and the JSX types' shape. Components are plain functions with no module API (`docs/proposals/0002-modules.md`, revised 2026-11-21). Also create every subpath entry of the package, so later nodes only fill in their own folders.

## Context

- Source: `docs/proposals/0002-modules.md` (Example, Rules, Messages) and `docs/proposals/0004-effects-refs-errors.md` (Refs, raw HTML).
- `packages/idlip/src/index.ts` has `Message`, `createMessage`, constructor types, `createConstructors` and a `defineModule` stub from an older design. Delete them, move `Message` (`{ t, p }`) to `src/core/format.ts` as an internal type, and delete `test/messages.test.ts`.
- Contract to freeze: `contracts/core-api.md`.

## Steps

- [ ] `For`, `trusted` and `TrustedHtml` as in `contracts/core-api.md`. `For` throws when called at runtime, since the compiler replaces it.
- [ ] `EventFor` and `EventProp` types for `idlip/jsx-runtime`, so `e.currentTarget` has the element's type. `jsx-types` fills in the intrinsic elements.
- [ ] Type tests for the todo component of 0002, Example: it compiles; `toggle(1)` in an event, a missing prop on a child, a `For` key that is not a field, and a wrong initial value in `satisfies T as T` fail. A test with `let x: T = v` shows TS2367, as the reason for the `let` rule.
- [ ] Subpath entries, each an empty `index.ts` with a doc block: `idlip` (core), `idlip/server`, `idlip/client`, `idlip/compiler`, `idlip/vite`, `idlip/jsx-runtime`. Add them to `exports` and to the tsdown entries.
- [ ] Install every dependency the milestone needs, so later nodes never edit `package.json` or the lockfile: `seroval` and `oxc-parser` as dependencies, `vite` as an optional peer and dev dependency, `fast-check`, `happy-dom` and `@oxc-project/types` as dev dependencies. Use `@latest` for each.
- [ ] Add `examples/*` and `e2e` to `pnpm-workspace.yaml`, so `e2e-harness` and `example-todo` only add their own folders.
- [ ] Tooling for later nodes, so they never edit shared config:
  - `tsconfig.json`: `jsx: preserve` and `jsxImportSource: idlip`.
  - `vitest.config.ts`: include `test/**/*.test.{ts,tsx}`. Tests that need a DOM set `// @vitest-environment happy-dom`.
  - `oxfmt.config.ts` and `oxlint.config.ts`: ignore `packages/idlip/test/fixtures/**/expected/**`, so golden files stay byte for byte.
  - `tsdown.config.ts`: mark `vite`, `oxc-parser` and `seroval` external.
  - Root `package.json`: `build`, `test` and `typecheck` also cover `examples/*`, and an `e2e` script runs `pnpm --filter e2e test`.
- [ ] Type tests with `expectTypeOf` in `test/core/`.
- [ ] Update `contracts/core-api.md` to match the code, set `status: frozen`.

## Acceptance

- [ ] `pnpm build` emits all six entries and `pnpm typecheck` passes.
- [ ] The type tests above pass with `expectTypeOf` and `@ts-expect-error`.
- [ ] Fast check passes: `pnpm --filter idlip test`

## Sizing

M: known pattern, but core types and the export map are shared by every node.

## Notes for the worker

- Nothing exported from `idlip` may exist only for the compiler, except `For` (0002, Decisions).

Landed on `batch/core` as b4cf59d. The deletion of `packages/idlip/test/messages.test.ts` is outside the owned paths and accepted: the contract Stub section requires it. The contract freeze (v7) waits for the user at the contract gate.
