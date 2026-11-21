# Outcome: compile-view-analyze

## Built

- `packages/idlip/src/compiler/view/analyze/`: the shipped view analysis, ported from the `spike-view-analysis` prototype. It produces the view IR of `contracts/view-ir.md` v8.
  - `index.ts` exports `analyze`, `printModule`, `printExpr`, `printPath`, the types `AnalyzeOptions` and `ImportedModule`, and every IR type (`ModuleIR`, `Component`, `Handler`, `Expr`, `Hole`, `Path`, `Node`, `Event`, `Diagnostic` and the rest).
  - `analyze(file, source, options?)`: one `*.idlip.tsx` source to a `ModuleIR`. It reads no files itself.
  - `options.readImport(specifier, importer)`: returns `{ file, source }` for an imported `.idlip.tsx` module, or `undefined`. With it, the analysis reads the import and applies the stateless rule: a stateless import is inlined, a stateful one is a `child` node. Without it, or when it returns `undefined`, every imported component is a `child` node, the prototype's behavior.
  - `printModule(ir, source)`: the text form the contract tests compare against.
  - `ir.ts`: the IR types, `impure?: true` on `call` included. `nesting.ts`: HTML nesting and implied-element rules. `print.ts`: printing.
- The AST is typed with `@oxc-project/types` (a dev dependency, type imports only). The prototype read it as `any`.
- View-ir v8: `Math.random`, `Date.now`, `performance.now` and `crypto.randomUUID` in a hole become `{ kind: 'call', callee: { kind: 'global', name: 'Math.random' }, helper: 'args', impure: true }` and read no paths. When the hole's path set is not empty, `hole-impure` is a warning that names the paths. `crypto.getRandomValues` and other globals stay `hole-global`. Handlers keep `handler-impure` as an error. Impure globals are allowed in holes only, attribute values included. In event arguments and message props they are `hole-global`, since the payload would fix the value at render. In state initial values they are `let-init`.
- Tests in `packages/idlip/test/compiler/view/analyze/`:
  - `fixtures/*.idlip.tsx.txt`: the prototype's fixtures plus `impure.idlip.tsx.txt`. They are stored as `.txt` so `tsc`, oxlint and oxfmt skip them, since several do not type-check or parse on purpose.
  - `expected/*.txt`: the printed IR per fixture, compared with `toMatchFileSnapshot`. `expected/counter.json` and `expected/todo.json` hold the full IR.
  - `analyze.test.ts` checks the printed and JSON IR. It checks that every one of the 74 contract rule ids except `hole-dynamic` fires with its severity, that each marker comment in `violations`, `parse` and `impure` fires its rule next to the marker, that no hole is `dynamic`, the impure-global cases, and imported components with and without `readImport`.

## Deviations

- `violations.idlip.tsx.txt` gained cases after review: an impure initial value (`let-init`), impure globals in an event argument and a message prop (`hole-global`), a block-bodied `<Try catch>`, a block-bodied `<For>` render and a non-name `<For>` index, and a clean stateless `Pick` component for the message prop case. Line numbers in `expected/violations.txt` shifted with them.
- `violations.idlip.tsx.txt` changed on one line for v8. `<p>{Math.random()}</p>` became `<p>{draft + Math.random()}</p>`, so `hole-impure` still fires, now as a warning. The marker comment on the line above changed too. Apart from that, the printed output of `counter`, `todo`, `edges`, `features` and `violations` is byte for byte the prototype's `out/` (`parse.txt` differs only in its file name line), and `counter.json` and `todo.json` are identical.
- `<Try catch>` with a block-bodied arrow, a `<For>` render arrow with a block body, and a `<For>` index that is not a plain name are now `try-catch`, `for-render` and `for-param`. The prototype either crashed or reported `hole-grammar`. These cases came up while typing the AST and now have markers in the violations fixture.
- `packages/idlip/src/compiler/index.ts` is not in the owned paths, so `idlip/compiler` does not export the analysis yet. Import from `src/compiler/view/analyze/index.ts` inside the package, or let the node that owns `compiler/index.ts` re-export it.

## Stubs left

- None. No `behavior` dependencies.

## Gotchas

- An imported stateless component can read only its props, pure globals and blocks from `idlip`. Its body is lowered against its own module. A read of one of its own imports or module-level bindings (a helper, a constant) is `component-import`, because that binding does not exist in the importing file and a `module` root would point at the wrong file. Lifting this needs a root that names its file, which is a contract change.
- Diagnostics and spans inside an imported component's body point at the `<Tag>` in the analyzed file. The message starts with `file:line:col` in the imported file.
- Holes of an inlined component (local or imported) have the span of the use site when imported, and of the component's own source when local. Code generation should not rely on hole spans to find text in the analyzed file for imported bodies.
- `findPaths` keeps `*` paths outside rows (`items[index].name` gives `items.*.name`). Code generation may coarsen them to `items`.
- JSX text is trimmed with React's rules (`normalizeJsxText`). The server renderer must match.
- An impure global reached only through an inlined helper in an event argument (`() => pick(roll())`, where `roll` calls `Math.random`) is not caught: the inline aborts and the call falls back to `helper: 'args'` without the `impure` mark, as in the prototype.
- The handler free-variable walk does not follow aliases: `const list = todos; list.push(x)` is not caught as a mutation.
- Expressions use the field name `then` on `conditional` nodes, as the contract fixes. oxlint warns `unicorn(no-thenable)` on the three object literals that build them. These are warnings, not errors.
- Timings (median of 20, Node 26, Apple silicon): todo 0.36 ms, features 0.79 ms, violations 0.73 ms.

## Proposed learnings

- Store fixtures that do not type-check or parse as `.txt` and load them with `import.meta.glob(..., { query: '?raw' })` | `tsc`, oxlint and oxfmt skip them, and the test needs no `@types/node` | `packages/idlip/test/` | no
- Type oxc ASTs with `@oxc-project/types` and narrow on `type` | typing a 3,000-line `any` pass took about 140 type errors to fix and removed about 850 lint errors | `packages/idlip/src/compiler/` | yes (lint `no-unsafe-*`)

## Verification

- `pnpm --filter idlip exec vitest run test/compiler/view/analyze` (the brief's `verify`): 91 passed.
- `pnpm --filter idlip test`: 101 passed, after rebasing onto `batch/core`.
- `pnpm --filter idlip typecheck`: no errors.
- `./node_modules/.bin/oxlint --type-aware`: 0 errors. 4 warnings in owned files: `no-thenable` on the contract's `then` field, and `no-template-curly-in-string` on a test fixture string.
- `pnpm format:check`: all files formatted.

## Size

- Estimated L, actual L. Most of the time went to typing the AST, plus cross-file component resolution.
