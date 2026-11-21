---
id: markup-ts-plugin
title: TypeScript server plugin for .idlip imports
status: todo
priority: should
type: feature
story:
early: false
outline: false
milestone: apps
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm --filter @idlip/typescript-plugin build && pnpm --filter @idlip/typescript-plugin test && pnpm --filter idlip-vscode build
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-21
spent:
owns:
  - packages/typescript-plugin/**
  - packages/vscode/package.json
  - packages/vscode/tsdown.config.ts
  - packages/vscode/scripts/**
shared:
  - pnpm-lock.yaml
reserves: []
provides: []
depends_on:
  - on: markup-frontend
    kind: hard
    why: needs @idlip/language-core and the VS Code extension on the main branch
---

# TypeScript server plugin for .idlip imports

## Goal

A `.ts` or `.tsx` file that imports `./x.idlip` is untyped in the editor, because the VS Code extension has no TypeScript server plugin. Add the package `@idlip/typescript-plugin` as brumate does with `@brumate/typescript-plugin`, and register it from `packages/vscode`, so TypeScript services see `.idlip` files as virtual TSX and the importing file gets the component's types.

## Context

- Source: the `markup-vscode` review. Prior art: `~/Documents/GitHub/brumate/packages/typescript-plugin/src/index.ts` (`createLanguageServicePlugin` from `@volar/typescript/lib/quickstart/createLanguageServicePlugin.js` with the language plugin; a proxy that removes repeated diagnostics), and in `~/Documents/GitHub/brumate/packages/vscode`: `typescriptServerPlugins` in `package.json`, the `typescript-plugin` entry in `tsdown.config.ts`, and `scripts/` that writes a `node_modules/<name>-pack` shim so the TypeScript server can load the bundled plugin by name.
- Read the outcomes of `markup-language-core` (`createIdlipLanguagePlugin`, how `.idlip` maps to TSX, the `tsconfig` requirements) and `markup-vscode` (the extension bundle, the wasm `oxc-parser` alias, `vsce package`). Both are on `feat/markup-frontend` until the story lands.
- The package is `0.0.0`, unpublished, like the other editor packages; no changeset (see their outcomes). The `.idlip` language id and `.idlip` extension come from `@idlip/language-core` (`LANGUAGE_ID`, `EXTENSION`).

## Steps

- [ ] `packages/typescript-plugin`: `package.json` (`@idlip/typescript-plugin`, deps `@idlip/language-core` and `@volar/typescript`), `tsconfig.json`, `tsdown.config.ts` (CJS output), `src/index.ts` exporting the plugin as default.
- [ ] Test: create a TypeScript language service with the plugin over a temp project where `main.ts` imports `./Counter.idlip`. Assert there is no TS2307 or TS7016 on the import, the default export has the component's type, and a wrong prop is a type error at the `.ts` position.
- [ ] `packages/vscode`: add the plugin as a dependency, bundle it as `dist/typescript-plugin.cjs`, add `contributes.typescriptServerPlugins` with `languages: ["idlip"]` and `enableForWorkspaceTypeScriptVersions: true`, and the script that writes the pack shim.
- [ ] Check that `pnpm --filter idlip-vscode package` still builds the `.vsix` and that the `.vsix` contains the plugin and the shim.

## Acceptance

- [ ] `pnpm --filter @idlip/typescript-plugin test` passes: the three assertions above.
- [ ] `pnpm --filter idlip-vscode build` bundles `dist/typescript-plugin.cjs`; `packages/vscode/package.json` registers it under `typescriptServerPlugins`.
- [ ] `pnpm --filter idlip-vscode package` writes a `.vsix` that lists the plugin and shim files.
- [ ] `pnpm build && pnpm typecheck && pnpm lint && pnpm format:check` pass.

## Sizing

M: a new package of 4 to 5 files plus edits to the extension's build; the pattern comes from brumate. Verifiability is partly manual: the test uses the TypeScript service, but VS Code itself is not opened.

## Notes for the worker

- Use the TypeScript 6 compiler through `typescript-api` where the server and `idlip-tsc` do; check how `packages/language-server` casts it before choosing the `typescript` dependency.
- Do not change `packages/language-core` or `packages/language-server`. If the plugin needs a change there, write `contracts/` change request text in your `log.md` and adapt locally.
- Bumping `oxc-parser` requires the matching wasm binding bump in `packages/vscode` (see `markup-vscode` gotchas).
- Say in `outcome.md` how to test by hand: open a `.ts` file that imports a `.idlip` file in the extension host.
