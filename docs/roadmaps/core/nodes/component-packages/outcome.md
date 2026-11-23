# Outcome: component-packages

## Public API

One `package.json` field of a component package, one new behavior of the plugin and four messages. No new plugin option, no new export, no change to the compiler format or to the loader. The field format is the one the user approved.

1. The `idlip` field of a package that publishes components as source:

```json
{
  "name": "@acme/ui",
  "idlip": { "version": 1, "dir": "src" },
  "exports": { "./*.tsx": "./src/*.tsx" },
  "files": ["src"],
  "sideEffects": ["**/*.css"],
  "peerDependencies": { "idlip": "^0.1.0" }
}
```

`version` must be `1`. `dir` is optional (default: the package folder) and must stay inside the package. The package ships `.tsx` source and no build output.

2. The app lists the package in `dependencies` or `devDependencies`, and `idlip()` compiles it with no option:

```ts
// vite.config.ts of the app: unchanged
idlip({ entry: '/src/entry-server.ts' });
```

```tsx
import Counter from '@acme/ui/counter.tsx';

<For each={items} key={(item) => item.id}>
  {(item) => <Counter label={item.label} start={item.start} />}
</For>;
```

The import keeps the `.tsx` extension: the compiler requires it for a child (`component-import`), so a package exports `./*.tsx`. Only direct dependencies count. The plugin adds the packages it finds to `ssr.noExternal`, `optimizeDeps.exclude` and `resolve.dedupe: ['idlip']`. The `modules` option still means the app's own files.

3. Names a user can see. The module id of a package file is `<package>/<path in the package>`, such as `@acme/ui/src/counter.tsx`. It is the key in the chunk map and in the state script. The built chunk files start with the package name, with a scope's `@` dropped and `/` as `-`: `acme-ui.counter.handler.add-<hash>.js`. In dev a chunk is served at `/@fs/<real file>?idlip-handler=add&lang.js`.

4. Error messages (thrown when `vite` starts):

```
@acme/ui uses idlip package format 2; this idlip reads format 1.
@acme/ui uses idlip package format undefined; this idlip reads format 1.
@acme/ui sets idlip.dir outside the package: ../x.
```

```
@a/b-c and @a-b/c both name their chunks "a-b-c". Use only one.
```

The first is the one the brief names. The second is a field with no `version`. The third (a `dir`, checked by its real path, that leaves the package) and the fourth (two packages whose names give one chunk name) are additions: user to confirm, or drop them.

## Built

- `packages/idlip/src/vite/packages.ts`: `readPackages`, `listPackageFiles`, `findPackage`, `getPackageId`, `getPackageFile`, `getPackageSlug`.
- `plugin.ts`: package files join `findModules`, `getModuleId` and `getFile`, package-prefixed chunk names, the `@fs` dev URL (`toChunkUrl`), the `resolveId` of a package view, the config defaults, `fs.allow` and the watcher for linked packages. `styles.ts`: `isScript(id, inPackage)`. `hot.ts`: `classifyEdit` takes an optional `locate`. `CLAUDE.md` of `vite/` has the rule.
- `examples/package-components` (app) and `examples/package-components/ui` (the package `@idlip-example/ui`, with a plain stylesheet and a CSS Module). `pnpm-workspace.yaml` lists the package.
- Docs: `website/docs/packages.md` (Guide, order 15).
- Tests: `test/packages/packages.test.ts` (9: reading, ids, bad `dir`, format error, missing version, two packages with a `button.tsx` built as real folders in `node_modules`, chunk names, chunk map keys, stylesheets linked), `e2e/tests/packages.spec.ts` (3 tests in the `packages`, `packages-dev` and `packages-fallback` projects). `e2e/fixture/chunk.ts` now reads a module name with a dot (`idlip-example-ui.counter`).
- Changeset `.changeset/component-packages.md` (`idlip`, minor).

## Acceptance

- E2E: the example renders a package component with its CSS (plain and CSS Module, before and after a click), a click loads the package counter's handler from its own chunk, and a list of package components plus a parent's clear work, in the production build served by Nitro, in `vite dev` with Nitro and in `vite dev` with the plugin middleware: pass.
- Unknown format version fails with the message: pass (`test/packages/packages.test.ts`).
- Two packages with a `button.tsx` build with distinct chunk names and keys: pass.
- Loader unchanged (no client source changed): the e2e budget test passes (4,096 B gzip budget).
- Checks after the review fixes (the root has no `pnpm check`): `pnpm build` (0 errors), `pnpm typecheck` (all projects), `oxlint --type-aware` (0 errors, existing warnings only), `pnpm format:check` (pass), `pnpm test` (88 files, 954 passed, 35 skipped), `pnpm --filter website build` (31 pages), `pnpm --filter e2e test` (52 passed in the last run; an earlier review run counted 44 passed and 8 skipped). Loader file unchanged (`loader.DejSiby1.js`).

## Deviations and gotchas

- The brief says `pnpm check`. The root has none; I ran the separate commands.
- A component is imported with its `.tsx` extension (see Public API 2). Why: a compiler rule I did not change.
- Only direct dependencies are scanned, as the brief says. A package that renders a component of another package needs that package in the app's dependencies too. Otherwise the plugin warns that the file is outside `modules`.
- A change of a package's `package.json` does not restart `vite dev`. Edits of a linked package's source do update the page.
- Review fix (separate commit): a child view that reads a CSS Module was a one-line stub plus a common chunk (from `component-styles`). A default import of a CSS Module in chunk code is now the class object written in the chunk (`inlineNames`), and a chunk that only the stylesheet entries import is dropped. `test/styles/build.test.ts` asserts one view file with no re-export.
- A transitive dependency check, `files` and the `exports` of a package are not validated by the plugin.
- Not done: CommonJS dependencies of a package (brumate's `optimizeDeps.include` note) were not tested, so the docs do not claim anything about them.
