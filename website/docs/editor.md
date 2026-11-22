---
title: Editor setup
order: 90
section: Tools
description: The tsconfig settings that type-check *.tsx files, and where idlip's own diagnostics appear.
---

A `*.tsx` file is plain TSX. Any editor with TypeScript support reads it, with no plugin: VS Code uses its built-in TypeScript, and other editors use the TypeScript language server. idlip has no editor extension and no TypeScript plugin yet.

There are two kinds of check:

- **Types**, from TypeScript with the JSX types of `idlip/jsx-runtime`. They show in the editor as you type, and `tsc --noEmit` reports them.
- **idlip rules**, from the compiler: the closed hole grammar, event props, block placement and the other rules on the [syntax page](./reference/syntax.md#diagnostics). They show in the terminal of `vite dev`, and an error fails `vite build`.

## tsconfig.json

Set `jsx` to `preserve` and `jsxImportSource` to `idlip`, so TypeScript reads the JSX types from `idlip/jsx-runtime` and leaves the views to the compiler.

```json
{
  "compilerOptions": {
    "target": "es2023",
    "lib": ["es2023", "dom"],
    "module": "preserve",
    "moduleResolution": "bundler",
    "strict": true,
    "verbatimModuleSyntax": true,
    "allowImportingTsExtensions": true,
    "skipLibCheck": true,
    "jsx": "preserve",
    "jsxImportSource": "idlip",
    "noEmit": true
  },
  "include": ["src", "vite.config.ts"]
}
```

- `jsx: "preserve"` keeps TypeScript from turning JSX into calls. The Vite plugin compiles every view.
- `jsxImportSource: "idlip"` points TypeScript at `idlip/jsx-runtime` for `JSX.Element` and the element types, such as `on:click` props and `class` records.
- `allowImportingTsExtensions` lets a server entry or a parent component import `./todo.tsx` by its full name, as the Vite plugin expects.
- `moduleResolution: "bundler"` reads the subpaths of `idlip` (`idlip/server`, `idlip/vite` and the others) from its `exports`.

Add a `typecheck` script and run it in CI next to the build:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "typecheck": "tsc --noEmit"
  }
}
```

## Return types

A component may declare its return type with `JSX.Element` from `idlip/jsx-runtime`. The type exists only for TypeScript, so import it with `import type`.

```tsx
import type { JSX } from 'idlip/jsx-runtime';

export default function Greeting(props: { name: string }): JSX.Element {
  let name = props.name;

  function rename(next: string) {
    name = next;
  }

  return <input value={name} on:input={(e) => rename(e.currentTarget.value)} />;
}
```

Event arrows are typed by element: in `on:input` on an `<input>`, `e.currentTarget` is an `HTMLInputElement`.

## idlip diagnostics

The Vite plugin compiles each module when Vite loads it. Each diagnostic is printed as `<module id>:<line>:<column> <rule>: <message>`, such as `/src/todo.tsx:12:3 let-unassigned: ...`. A warning is logged and the build goes on. An error fails the load of the module, so `vite build` stops and `vite dev` reports it in the terminal.

To check every module without a build, call `compile` from `idlip/compiler` in a script and print its diagnostics. See [idlip/compiler](./reference/compiler.md#compile).

## VS Code

- Open the project folder, so VS Code finds `tsconfig.json`.
- `.tsx` files use the TypeScript React language mode, which is the default for `.tsx`. No file association is needed.
