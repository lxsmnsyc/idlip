# Change request: compiled-format v13 to v14

- From node: multi-component-files
- Status: proposed. The code on `node/multi-component-files` follows it.

## Problem

The contract has one component per file. `manifest.module` is the file's Vite id, a file has one server module with one `manifest`, one `chunks` and one `default`, and `CompileResult` holds one manifest. The user decided on 2026-11-22 that a `.tsx` file may hold several components: the default export, named exports, and private components that one of them renders. Each needs its own model, chunks and manifest.

## Proposed change

**Module ids.**

- The main component of a file keeps the file's id, `/src/widgets.tsx`. The main component is the default export. A file with no exported component keeps the old rule: its first stateful component.
- A file with named exports and no default export has no main component. Every component in it has a `#<Name>` id.
- Every other component has the id `<file>#<Name>`, such as `/src/widgets.tsx#Counter`. `Name` is the component's name in the source. It starts with a capital letter and holds no `#`, `?`, `/` or `.`.
- `splitModule(module)` in `format.ts` returns `{ file, name }`. It reads a name only from a final `#[A-Z][^#?/.]*`, so a `#` in a folder or file name (`/src/a#b/c.tsx`) stays part of the file. `getChunkId` uses the same pattern.

**Chunk ids and files.**

- `getChunkId('/src/widgets.tsx#Counter', 'handler=add')` is `/src/widgets.tsx?idlip-Counter.handler=add&lang.js`. The id of the main component is unchanged.
- The chunk names inside a manifest stay `handler=add`, `binding=count`, `view`. Only the id adds the component's name.
- The Vite plugin names the file `widgets.Counter.handler.add.<hash>.js`. The main component's files are unchanged (`widgets.handler.rename.<hash>.js`).
- `parseChunkId(id)` returns `{ file, module, chunk }`. A chunk kind never starts with a capital letter, so `<Name>.` and the kind cannot be confused.
- Why this form: the default export renames nothing, so every existing chunk name and golden stays. The name reads in the file list. The id keeps the real file before `?`, so Vite's module graph ties the chunk to the file and a hot edit reaches it. `getChunkId` grows the loader by 28 B with gzip (todo loader 3979 B to 4007 B, budget 4096 B).

**Server module.** One per file, as before.

- The main component exports `manifest`, `chunks`, `uses` and `default`, unchanged.
- Each other component has a module record `const $Name = { manifest, chunks, default: Name }`, exported when the source exports the component, and a render function `function Name(props, context, model, path?)`, exported likewise. Its `context.state` call reads `$Name.manifest`, `$Name.chunks` and `$Name.uses`.
- `$Name.uses = [...]` assignments come after every record, so components of one file may render each other in any order. When a component of the file renders the main one, the module also has `const $Main = { manifest, chunks, default: Main }`.
- A parent imports a default child as `import * as Counter from './counter.tsx'`, as before, and a named child as `import { $Counter as Counter } from './widgets.tsx'`. A child of the same file is its record, `$Row`. The child call is `<ref>.default(props, context, model, path)` in every case.
- A file with no main component exports no `manifest`, `chunks`, `uses` or `default`. It exports one record and one render function per exported component. `import X from` such a file fails, as it would for the source.
- `vite-plugin` replaces the URLs of `export const chunks` and of the `chunks` field of every generated record: a `$Name` declaration whose object has `manifest` and `default: Name`.
- A module-level author name equal to a record name (`$Counter`) is `module-reserved-name`.

**Compiler API.**

- `CompileResult.components?: CompiledComponent[]`, where `CompiledComponent` is `{ manifest, client }`. `manifest` and `client` stay the main component's. `components` lists the others in source order, absent when there are none. `listCompiled(result)` returns all of them.
- In a file with no main component, `manifest` and `client` hold the first named component in source order (`manifest.module` is `/src/tools.tsx#Clock`), and `components` the rest.
- `compile` options gain `children?: string[]`: the names of the named components that another file renders. `child` stays for the main component. A component that another component of the same file renders is always a child.
- `listChildImports(source, id)` returns `{ source, imported }` per child import. `listChildren` stays.

**Diagnostics.**

| Rule                  | Severity | Cause                                                                                                           |
| --------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `component-form`      | error    | A capitalized arrow or function expression that holds JSX, or an unnamed default export.                        |
| `component-export`    | error    | `export { Counter as Tally }`, or one component that is both the default and a named export.                    |
| `component-duplicate` | error    | Two components whose names differ only in case.                                                                 |
| `component-unused`    | warning  | A stateful component that is not exported and that no exported component renders.                               |
| `component-name`      | error    | An exported function that returns JSX under a name that does not start with a capital letter (`counter`, `$B`). |

- Each diagnostic points at the declaration of the component it names.
- When a component rule reports an error, `compile` adds no `codegen-component` (`The file has no component`).

**Contract text.** Chunk URLs: add the `#<Name>` module id and the chunk id form. Server module: add the module record and the named render function. Compiler API: add `components` and `children`. Version history: add a v14 line.

## Affected nodes

- `ssr-render` and `resume-loader`: no change. They key by `manifest.module` and call `getChunkId`.
- `vite-plugin`: `listCompiled` in `buildStart`, `load`, chunk URLs, features and hot edits.
- `idlip/testing`: `mount` serves every component's chunks, gives chunks `addChild` and `setProp`, and its check renders children from their slot models.
- `vite-plugin` (separate `fix:` commit, also needed on `batch/core`): a binding chunk that renders a condition branch and a `try` chunk may import a child's view chunk, as a list chunk may. Before, a child inside a condition failed the build.

## Workaround in place

`format.ts` (`getChunkId`, `splitModule`, `listCompiled`, `CompiledComponent`) changed on the node branch. `src/core/**` is outside the node's owned paths, and the change is needed for every consumer.

## Not done

- Arrow components. A component is a function declaration, as `components.md` says. An arrow that returns JSX gets `component-form` with the fix.
- A named export under another name. It gets `component-export`.
