---
id: core-api
title: Freeze the core API and the package layout
status: todo
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
spent:
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

# Freeze the core API and the package layout

## Goal

Freeze the types every other node builds on: messages, update handlers, commands, subscriptions and the serializable model constraint. Also create every subpath entry of the package, so later nodes only fill in their own folders.

## Context

- Source: `docs/proposals/0001-dsl.md`, sections Messages, Model, Update, Commands and subscriptions.
- `packages/idlip/src/index.ts` already has `defineMessages`, `createMessage`, `Message`, `MessageOf`. Move them to `src/core/messages.ts` and re-export.
- Contract to freeze: `contracts/core-api.md`.

## Steps

- [ ] `defineUpdate<Model, Messages>(handlers)`: an object keyed by tag. A handler returns `Model` or `[Model, Cmd]`.
- [ ] `Cmd` and `Sub` as plain data: `{ kind, args, to }` where `to` is a message tag. `Cmd.none`, `Cmd.batch`.
- [ ] `Serializable` type that rejects functions, class instances and DOM nodes in a model, and accepts the seroval types (Date, Map, Set, bigint).
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
- [ ] Type tests show a handler with a wrong payload type and a model with a function both fail to compile.
- [ ] Fast check passes: `pnpm --filter idlip test`

## Sizing

M: known pattern, but core types and the export map are shared by every node.

## Notes for the worker

- Tags are camelCase. A tag with no payload has the payload type `undefined`. Do not use `void`, the lint config rejects it.
- Do not copy Elm's API names when a TypeScript-shaped name reads better.
