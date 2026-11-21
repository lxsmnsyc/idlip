# Outcome: compile-update

## Built

- `packages/idlip/src/compiler/update/`:
  - `index.ts` exports `compileHandlers(file, source, ir?)` and `listHandlerProps(component, handler)`.
  - `compileHandlers` returns `{ client: Module[], diagnostics: CompileDiagnostic[] }`. `client` holds one `{ chunk: 'handler=<name>', code }` per handler. It is empty when a diagnostic is an error. `ir` is the analysis of the same source and defaults to `analyze(file, source)`. The component is the exported stateful one, else the first stateful one. Diagnostics are those of the analysis whose rule starts with `handler-` or `await-`, plus the three below.
  - `handlers.ts`: the closure of a handler (itself and every handler it calls), its helpers, imports, derived values, state reads and writes, and the chunk text.
  - `emit.ts`: cuts types out of a source range, rewrites props reads, rewrites `return` statements, and re-indents.
- Chunk shape, as in `contracts/compiled-format.md` v8:
  - `import` lines for the names the chunk uses, then module-level helpers it reaches (transitively, in source order, without `export`), then `export function <tag>(model, [props$..., args...])`. Props come first so a rest parameter stays last.
  - The body starts with `let { <state> } = model;`, state in source order, for every field the closure reads or writes. Every top-level `return` and the end of the body return `{ ...model, <written fields> }`, or `model` when nothing is written.
  - A called handler is a nested function declaration in the same chunk. It shares the state locals, so its writes show in the caller.
  - A props read becomes a payload variable named by its path: `props.step` is `props$step`, `props.user.name` is `props$user$name`. A destructured prop `start` is `props$start`.
- Tests in `packages/idlip/test/compiler/update/handlers.test.ts` (12) and `semantics.test.ts` (9): the golden fixtures `counter` and `todo` (byte for byte, and the same file set), a helper in the chunk with its own helper and import, an unused helper and import left out, props as payload fields (param and pattern styles), a handler calling a handler, derived values, returns and type stripping, and the three error cases. `semantics.test.ts` covers scope (a parameter or a local named like a prop), the value of a `return`, recursion, the payload order, stale derived values, `helper-module-state` and `handler-return-finally`.

## Deviations

- None to owned paths. `packages/idlip/src/compiler/index.ts` is not owned, so `idlip/compiler` does not export `compileHandlers` yet. `compile-integration` imports it from `src/compiler/update/index.ts`.
- Rule ids that the view-ir contract does not list, all mine (`helper-module-state` and `handler-return-finally` are errors too):
  - `handler-await` (error): a handler with an `await`, until `custom-effects`. The analysis allows it.
  - `handler-derived-props` (error): a handler reads a derived value that reads props. The payload cannot carry it, since the analysis records props paths only for the handler's own reads.
  - `handler-derived-stale` (warning): a handler reads a derived value after it wrote a state field the value depends on. See Gotchas.
  - `helper-module-state` (error): a copied helper assigns a module-level `let`; copies would diverge between chunks.
  - `handler-return-finally` (error): a `return` in a `try` block that has a `finally`; the finally's writes would be lost.

## Stubs left

- None.

## Gotchas

- Payload order: `[...props paths, ...arguments]`. The props part is `listHandlerProps(component, handler)`: the props paths of the handler, then those of the handlers it calls, in discovery order. `compile-view-codegen` must write the same list into the event payload (the IR's `free` of one handler holds only its own reads). The chunk adds any path it finds in the body that is missing from the IR, at the end.
- The IR records the longest static chain, so `props.user.name.length` is one path and one variable, `props$user$name$length`.
- A derived value a handler reads is computed once, at the start of the chunk, from the incoming model. A read after a write in the same handler sees the old value. `handler-derived-stale` warns about it.
- Props rewriting, derived-props detection and helper detection are scope aware: a parameter, local, loop or catch name that shadows a prop or helper is left alone.
- In the exported entry, `return expr` becomes `{ expr; return <model>; }`, so `expr` still runs. A called handler keeps `return expr`. A handler that calls itself is nested in the exported function, so recursion reaches the nested copy; its payload is `[props..., ...$args]`.
- A method call on a props path (`props.list.map(f)`) reads `props.list` in the chunk. The analysis records `list.map` as the path, so the payload gets an extra unused slot and `compile-view-analyze` should record `list`.
- Comments between statements stay inside the body. Comments outside the body are dropped. Lines inside multi-line template literals keep their text, other lines are re-indented to two spaces.

## Proposed learnings

- Cut types by collecting edit ranges from the oxc AST and slicing the source, not by printing a new tree | keeps the author's formatting, which the golden fixtures compare | `packages/idlip/src/compiler/` | yes (golden fixtures)

## Verification

- `pnpm --filter idlip exec vitest run test/compiler/update` (the brief's `verify`): 21 passed.
- `pnpm --filter idlip test`: 148 passed.
- `pnpm typecheck`: no errors. `pnpm format:check`: clean. `./node_modules/.bin/oxlint --type-aware`: 0 errors, only the existing `no-thenable` and `no-template-curly-in-string` warnings.

## Size

- Estimated M, actual M.
