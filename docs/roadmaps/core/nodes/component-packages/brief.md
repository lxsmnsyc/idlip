---
id: component-packages
title: Compile idlip components from npm packages
status: done
priority: must
type: feature
story:
early: false
outline: false
milestone: '0.1'
target:
ship: auto
land: auto
from:
size: M
spike: false
hypothesis:
verify: pnpm check
exclusive: []
fulfilled_by:
gate: false
added: 2026-11-23
spent: 444000
owns:
  - packages/idlip/src/vite/packages.ts
  - packages/idlip/test/packages/**
  - examples/package-components/**
  - website/docs/packages.md
shared:
  - packages/idlip/src/vite/**
  - packages/idlip/src/server/**
  - pnpm-workspace.yaml
  - e2e/**
  - website/docs/**
reserves: []
provides: []
depends_on:
  - on: component-styles
    kind: hard
    why: a package's CSS travels through the stylesheet mechanism, and both nodes edit the plugin's build data
---

# Compile idlip components from npm packages

The plugin finds components with `globSync(modules ?? 'src/**/*.tsx', { exclude: ['**/node_modules/**'] })`. A component imported from a package is not compiled; the build only warns that it is outside `modules`. Shared component libraries cannot exist.

Decision approved by the user (2026-11-23): follow brumate `docs/packages.md`. A package marks itself in its `package.json`:

```json
{
  "idlip": { "version": 1, "dir": "src" },
  "peerDependencies": { "idlip": "^0.1.0" },
  "sideEffects": ["**/*.css"]
}
```

It publishes its `.tsx` source under `dir`. The app's plugin compiles it.

Read first: brumate `docs/packages.md` and its plugin code for the dependency scan, `packages/idlip/src/vite/plugin.ts` (`findModules`, module ids, chunk names, `optimizeDeps`, `ssr.noExternal`), and the Nitro integration from `entry-setup`.

## Do

- Scan the app's `dependencies` and `devDependencies` (direct ones, resolved from the app root, symlinked workspace packages included) for the `idlip` field. Compile every `.tsx` under each package's `dir` as an idlip module.
- Keep those packages out of `optimizeDeps` and in `ssr.noExternal` (and Nitro's externals), so their files reach the plugin in dev and in build.
- Module ids and chunk names are stable and unique across packages: prefix with the package name, so two packages with a `button.tsx` do not collide.
- A field `version` other than 1 fails at startup: "<package> uses idlip package format <n>; this idlip reads format 1."
- Components from a package work as children of app components, inside `<For>`, with their own state, and across resume. Their CSS (plain and CSS Modules) is linked through `component-styles`.
- An example: `examples/package-components` holds a workspace package with the field and an app that uses it. Docs page `website/docs/packages.md`: how to publish a component package.

## Acceptance

- An e2e test: the example app renders a package component with its CSS, a click runs the package component's handler from its own chunk, after a production build and in dev.
- A test: an unknown format version fails with the message above.
- A test: two packages with the same file name build without a chunk name collision.
- `pnpm check` passes.

Landed 2026-11-23 on batch/core (1bb7420, 2f1502e, ec5e6e8): packages with an `idlip` field compile from node_modules and workspace links; startup errors for format version, dir outside the package and clashing chunk slugs. Reviewed, one fix round, which also made a CSS Module view one file again.
