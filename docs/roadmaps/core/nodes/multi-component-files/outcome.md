# Outcome: multi-component-files

## Built

- **Components of a file.** The default export, each named export (`export function Counter`, `export { Counter }`), and each other component that one of them renders as a stateful child (`<Row />`) compile to their own manifest, chunks and server render function. `selectComponents` in `packages/idlip/src/compiler/view/codegen/components.ts` picks them. A file with no exported component keeps the old rule: its first stateful component is the main one.
- **Naming scheme.**

  | Component        | Module id (`manifest.module`) | Chunk id                                                   | Chunk file                                    |
  | ---------------- | ----------------------------- | ---------------------------------------------------------- | --------------------------------------------- |
  | default export   | `/src/widgets.tsx`            | `/src/widgets.tsx?idlip-handler=rename&lang.js`            | `widgets.handler.rename.<hash>.js`            |
  | named or private | `/src/widgets.tsx#Counter`    | `/src/widgets.tsx?idlip-Counter.handler=increment&lang.js` | `widgets.Counter.handler.increment.<hash>.js` |
  - The default export renames nothing, so every existing chunk name and golden fixture is unchanged.
  - The chunk names inside a manifest stay `handler=increment`. Only `getChunkId` adds the name, so the loader, the patcher and the state script read every component the same way.
  - A component name starts with a capital letter and a chunk kind does not, so `parseChunkId` splits `Counter.handler=increment` without ambiguity.
  - The real file stays before `?`, so Vite's module graph ties the chunk to its file and a hot edit reaches it. A path-like id (`/src/widgets.tsx/Counter`) would lose that.

- **Server module.** One per file. The main component exports `manifest`, `chunks`, `uses` and `default` as before. Each other component has a module record `$Name = { manifest, chunks, default: Name }` and a render function `Name(...)`, both exported when the source exports the component. `$Name.uses` is assigned after all records. A parent imports a named child as `import { $Counter as Counter } from './widgets.tsx'`, and `render(Counter, props)` renders a named component as a page root.
- **Compiler API.** `CompileResult.components?` (`CompiledComponent[]`), `listCompiled(result)` and `splitModule(module)` in `core/format.ts`. `compile` option `children` names the named components another file renders. `listChildImports(source, id)` returns `{ source, imported }`.
- **Vite plugin.** `buildStart`, `load`, chunk URLs, `replaceChunkUrls`, feature detection and `classifyEdit` read every component. `findChildren` records the imported names per file.
- **`idlip/testing`.** `mount` serves the chunks of every component, records a named component's chunk as `Counter.handler=increment`, and its check renders children from their slot models.
- **Diagnostics.** `component-form` (arrow, function expression or unnamed default that holds JSX), `component-export` (export alias, or default and named export of one component), `component-duplicate` (names that differ only in case), `component-unused` (warning: a private stateful component nothing renders), `component-name` (an exported function that returns JSX under a name without a capital letter, such as `counter` or `$B`), each at the declaration's span, and `module-reserved-name` for an author name equal to a record name. `codegen-unsupported` now allows components of the file and named imports.
- **Docs.** `website/docs/components.md` ("Several components in one file" and the error table) and `website/docs/nesting.md` ("Several components in one file": a parent with a named and a private child, the chunk names, a named import).
- **Tests.** Fixture `packages/idlip/test/fixtures/widgets/widgets.tsx` (default `Dashboard`, named `Counter`, private `Row`). `test/compiler/compile/components.test.ts` (22 tests: shape, mount with a click in each component, named imports, diagnostics and their spans, a named-only file, a child of the same file inside a condition, `#` in paths). `test/vite/components.test.ts` (9 tests: build file names, chunk map, built server render of the page and of `Counter` as a root, dev serving, hot edits, a named-only file with a named and a private child inside conditions). `test/vite/condition-child.test.ts` (a child from another file inside a condition builds).

## Deviations

- **Arrow components are not supported.** The brief lists "a component that is not a function declaration or arrow" as the diagnostic. The analyzer, the handler compiler and the module scope read function declarations only, and `components.md` defines a component as one. An arrow or function expression with JSX gets `component-form` with the declaration form to write.
- **Export aliases are errors.** `export { Counter as Tally }` is `component-export`, since the name is part of the chunk names. Importing under another name works.
- **Change request path.** The brief named `contracts/compiled-format.change-request.md`, which holds the applied v7 to v8 request. The request is `contracts/compiled-format.v14.change-request.md`, named as the v12 and v13 requests are.
- **Files outside the owned paths.** `packages/idlip/src/core/format.ts` (`getChunkId`, `splitModule`, `listCompiled`, `CompiledComponent`) and `packages/idlip/src/testing/index.ts`. Every consumer of chunk ids needs the first, and the acceptance test needs the second.

## Stubs left

- None.

## Gotchas

- Loader size: `getChunkId` adds 28 B with gzip. The todo loader is 4007 B against the 4096 B budget. A version anchored on `[\w$]` saves 2 B but breaks non-ASCII component names.
- A child inside a condition failed the build before this node (`checkChunkImports` allowed a view import only from list and view chunks). The `fix:` commit `5b28081` also allows binding and try chunks. It applies to `batch/core` on its own, with a one-line conflict in the regex name.
- A file with named exports and no default export has no main component. Its server module has no `default`, and `CompileResult.manifest` is its first named component.
- A stateless named export also gets a record and a render function, so it can be a page root. Where its file renders it, it is inlined as before.
- `compileHandlers(file, source, ir, component)` takes the component now. Without it, it picks the first stateful component, as before.

## Proposed learnings

- Read the components of a compile result with `listCompiled(result)` | a loop over `result.manifest` misses every named component | `packages/idlip/src/vite`, `packages/idlip/src/testing` | yes, the build test in `test/vite/components.test.ts` fails on a missed chunk
- A generic walk over IR objects loops on the stack's length | a field can hold `undefined`, and `for (let x = stack.pop(); x !== undefined; ...)` stops early | `packages/idlip/src/compiler` | no

## Verification

- `pnpm --filter idlip build` ok. `pnpm --filter idlip test`: 63 files, 705 tests passed (673 before, 32 new).
- `pnpm --filter website build`: 28 pages. `check:samples`: 49 samples, 0 problems. `pnpm --filter website test`: 66 passed.
- `E2E_PORT=48621 E2E_COUNTERS_PORT=48622 E2E_SUBS_PORT=48623 E2E_HOT_PORT=48624 pnpm -C e2e test`: 18 passed, including the loader budget.
- `pnpm -C benchmarks/idlip build`, `build:rows`, `build:dashboard`, `build:scale`: all exit 0.
- `pnpm lint`: exit 0 (warnings only, none new in error). `pnpm exec oxfmt --check .`: clean.

## Size

- Estimated L, actual L.
