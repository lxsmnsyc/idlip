# Outcome: compile-integration

## Built

- `packages/idlip/src/compiler/index.ts`: `compile(source, id)` runs `analyze`, then `compileHandlers` and `generate` on the same IR. It returns `{ server, client, manifest, diagnostics }`. Handler chunks come first, then binding and list chunks. An error diagnostic gives `server: ''` and `client: []`. Diagnostics keep their spans; handler ones are merged once.
- `idlip/compiler` also exports the analysis (`analyze`, printers, IR types), `compileHandlers`, `listHandlerProps`, `pickComponent` and `generate`.
- `packages/idlip/test/compiler/compile/compile.test.ts`: 11 tests, both fixtures plus an error case.
- `vite-plugin`'s default `compile` reads `compile` from `idlip/compiler`, so it now resolves with no change in that node.

## Acceptance

- [x] Exports listed above; one `pickComponent` in `compiler/update`, used by codegen.
- [x] Both fixtures: manifest equal, server `manifest` and `chunks` constants equal, same chunk files, handler and binding chunks equal after formatting and removing helper aliases.
- [x] Diagnostics reach the caller with spans (`jsx-spread` test).
- [x] `pnpm --filter idlip test`: 9 files, 222 tests pass.

## Deviations

- `src/compiler/update/handlers.ts` and `update/index.ts`: exported `pickComponent`. `src/compiler/view/codegen/index.ts`: dropped its own copy and imports it, keeping its fallback to the first component.
- Golden code is not compared byte for byte. The fixtures are hand-formatted and use no helper aliases. The test compares formatted handler and binding chunks, and runs the list chunks and the server module against the fixtures by behavior.

## Checks

`pnpm --filter idlip test`, `format:check`, `typecheck`, `oxlint --type-aware` and `pnpm build` pass.
