---
title: Component packages
order: 15
section: Guide
description: Publish components as a package of source files. The app's plugin compiles them with its own files.
---

A package can ship idlip components for other apps. It ships them as source, and the Vite plugin of the app compiles them together with the app's own files. A package ships no compiled output.

## Set up `package.json`

```json
{
  "name": "@acme/ui",
  "version": "1.0.0",
  "type": "module",
  "idlip": { "version": 1, "dir": "src" },
  "exports": {
    "./*.tsx": "./src/*.tsx"
  },
  "files": ["src"],
  "sideEffects": ["**/*.css"],
  "peerDependencies": {
    "idlip": "^0.1.0"
  }
}
```

- `idlip` marks the package. The plugin of an app compiles every `.tsx` file under `dir` as an idlip module. A file with no component, such as a helper, stays plain TSX. Without `dir`, the plugin reads the whole package folder. Folders named `node_modules` and hidden folders are skipped.
- `version` is the version of this field. This version of idlip reads `1`. Any other value, or none, stops `vite` at startup with `@acme/ui uses idlip package format 2; this idlip reads format 1.`
- `exports` lets the app import `@acme/ui/button.tsx`. A component is imported with its `.tsx` extension, as in the app, so export the files with it.
- `files` publishes the source.
- `sideEffects` keeps a bundler from dropping the stylesheets that a component imports. List `**/*.css` and the other styles the package imports.
- `peerDependencies` names the versions of idlip that the package works with. The app and its packages share one copy of the runtime.

The app adds the package to its `dependencies` or `devDependencies`, and imports from it like any module:

```tsx
import { For } from 'idlip';
import Counter from '@acme/ui/counter.tsx';

<For each={items} key={(item) => item.id}>
  {(item) => <Counter label={item.label} start={item.start} />}
</For>;
```

A package component has its own state, works as a child of the app's components and inside `<For>`, and resumes like an app component.

## How the plugin finds packages

When `vite` starts, the plugin reads the `package.json` of the app. For each entry of its `dependencies` and `devDependencies` that has an `idlip` field, it:

- compiles the package's `.tsx` files as idlip modules, the same as the files that `modules` matches,
- adds the package to `ssr.noExternal` and `optimizeDeps.exclude`, so its files reach the plugin in `vite dev` and in a build, and Nitro's server bundle holds them.

Only direct dependencies count. A package that uses components of another package needs that package in the app's dependencies as well. A linked package, such as one of a pnpm workspace, is read at its real folder, and `vite dev` serves and watches it even outside the project.

The `modules` option is for the app's own files and does not list packages.

## Names

A module of a package is named by the package and the path in it: `src/button.tsx` of `@acme/ui` is `@acme/ui/src/button.tsx`. The name is the same wherever the package is installed. The built chunk files carry the package name before the file name (`@acme/ui` is `acme-ui`), such as `acme-ui.button.handler.press-<hash>.js`, so two packages that both have a `button.tsx` do not collide. Two packages whose names give the same chunk name, such as `@a/b-c` and `@a-b/c`, stop `vite` at startup. The chunk files of the app's own files keep their names.

## Styles

A component imports its stylesheet and CSS Modules as an app component does:

```tsx
import './counter.css';
import styles from './counter.module.css';
```

The page links the stylesheets of every component it can render, packages included. See [Styles](./styles.md). A stylesheet that a package imports from a file under its source folder is linked even when the package is installed in `node_modules`. A stylesheet that a plain `.ts` module of a package imports is linked as well.

## Limits

- A package cannot ship the entry or the pages of an app.
- A child component that reads a CSS Module loads its view from two small files instead of one, in a package and in an app alike.
- A change to the `package.json` of a package does not restart `vite dev`. Restart it after you change the `idlip` field.
