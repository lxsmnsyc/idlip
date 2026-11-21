# Outcome: nesting-compile

## Built

- Codegen for `child` nodes and message props, in `packages/idlip/src/compiler/view/codegen/`:
  - `child.ts` (new): the server call of a child (`Counter.default(props, context, context.slots?.[p]?.model, p)` between `<!--n:p-->` and `<!--/n-->`), the client call (`addChild(slot, module, View, props)`), `printSlot` and `printProps`.
  - `plan.ts`: `p` bindings for child props and for message props, `ChildInfo` (site and enclosing loops), `Used` (the child components) and `getStatePaths(..., child)`. With `child: true`, `props.*` paths are binding paths, and an event on a prop (`on:click={props.onRemove}`) is an `a` binding in the group `props.onRemove`.
  - `chunks.ts`: `p<id>` chunks (`setProp`), the `view` chunk (`init`, `render`), the item template with `addChild` (takes `scope`, reads `scope.path`), loader imports (`addChild`, `setProp`) and child view imports.
  - `index.ts`: `generate(ir, source, id, { child, resolve })`. `child` adds `manifest.view`, the `view` chunk and its `chunks` entry. The server module gets `path` (default `''` when it renders children), `uses`, `import * as Child from '<specifier>'` and `context.state({ ..., uses }, path)`.
  - `events.ts`: `getMessage(..., owner)` writes a message prop as `[tag, payload, modifiers, owner]`. An event on a prop forwards `props.<name>`.
  - `html.ts`: the `child` case and `HtmlBuilder.target` (`server` or `client`).
- `idlip/server` exports `slot`, and client chunks copy `slot$` with `encode$` (`src/core/helpers.ts`).
- `src/server/render.ts`: `render()` takes `context.state(state, path)`. The call without a path is the root's. Calls with a path become `slots`. It merges `modules`, chunk URLs and the union of event types from the `uses` closure.
- `$step: true` on every step the compiler emits (`src/compiler/update/segments.ts`).
- Tests: `test/compiler/view/codegen/nesting.test.ts` (15 tests).

## Deviations

- Files outside the brief's owned and shared paths that I edited:
  - `src/compiler/update/segments.ts`: `$step: true` (the note from `nesting-format` asks for it).
  - `src/core/helpers.ts`, `src/server/helpers.ts`, `src/server/index.ts`: the `slot` helper has one source, as the other render helpers do.
  - `src/compiler/view/codegen/expr.ts`: `Usage` gains `loader`, `views` and `path`, and a `props` read adds the `props` scope in server mode too (the `view` chunk needs it).
  - `src/compiler/view/codegen/text.ts`: `path` is a reserved local name, so a state field `path` becomes `path$`.
- `compile(source, id, options)` is not changed, since `src/compiler/index.ts` is not owned. `generate` takes the `child` option and a `resolve(specifier, importer)` function. `compile-integration` and `vite-plugin` must forward both. Without `resolve`, a relative specifier is resolved against the importer's id. The fixtures need a resolver, because `../counter/counter.idlip.tsx` next to the id `/src/board.idlip.tsx` is not `/src/counter.idlip.tsx`.
- `Manifest.view` is not in `src/core/format.ts` (contract v10 is not applied). `index.ts` has a local `ChildManifest` type.
- The server module is compared as for `counter` and `todo` (manifest and chunk constants, rendered page, and through `render()`). Every client chunk, the item template and `view` included, is compared as text after formatting. Behavior tests cover the template and `view` as well.
- `let-reserved` (a state field that starts with `$`) is not added. It belongs to the analysis, not to codegen.
- Slot key order: the loop keys, outermost first, then an explicit `key`. The change request does not fix the order.

## Goldens changed

- `test/fixtures/effects/expected/client/handler.add.js`, `handler.persist.js`, `handler.rename.js`: `$step: true` in each step with a task.
- Nested goldens regenerated after the rebase onto `write-sets`: `manifest.json`, the manifest in `server.js` and the state script in `page.html` of `nested/counter` and `nested/board`. Handlers gain `writes` and `bindings`: `increment` writes `count`, and `remove` and `clearAll` write `items`.
- `nested/board/expected/client/list.2.js` and `nested/counter/expected/client/view.js` were rewritten from the hand-written concatenation to the compiler's template-literal output, so they compare as text.
- The `counter` and `todo` goldens are unchanged. `test/compiler/update/effects.test.ts` expects `$step`.

## Stubs left

- `idlip/testing` does not re-render children from `context.slots` yet (`testing-mount`).
- `nesting-runtime` replaces the reference `addChild` and `setProp`, and makes `isStep` test `$step`.

## Gotchas

- A child module's `props.*` paths are binding paths only when `generate` gets `child: true`. The same module compiled as a root keeps the old output.
- A binding's `path` is optional in the scope. Chunks default it to `''`, and `p<id>` reads `scope.path ?? ''`.
- A `p` binding reads its row into locals from `scope.rows`, so its code reads like a template's.
- The server renders a child's `let` initializers from its own props, and a `model` from `context.slots` replaces them.
- The `no-cycle` lint rule forbids `chunks.ts` and `child.ts` importing each other. The binding and `view` emitters are in `chunks.ts`.

## Proposed learnings

- A loader export that chunks import must be listed in `Usage.loader` and held by the loader | chunks may import only what the loader holds | packages/idlip/src/compiler | no

## Verification

- `pnpm --filter idlip exec vitest run test/compiler/view/codegen/nesting.test.ts test/fixtures`: passed.
- `pnpm --filter idlip test`: 28 files, 494 tests passed.
- `pnpm build && pnpm --filter e2e test`: 10 passed with `$step` output (the loader's `isStep` still tests `'task' in result`).
- `pnpm typecheck`: passed. `pnpm lint`: no errors. `pnpm format` run.

## Size

- Estimated M, actual M.
