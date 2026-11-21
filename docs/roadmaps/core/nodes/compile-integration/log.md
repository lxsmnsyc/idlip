# Log: compile-integration

- Wired `compile()`: analyze once, `compileHandlers(id, source, ir)`, `generate(ir, source, id)`. Handler diagnostics merge in without duplicates.
- Moved the component picker to `compiler/update/handlers.ts` (exported); codegen imports it.
- The fixtures are hand-formatted, so the test compares the manifest, the server constants, chunk file names and normalized chunk code, as the codegen test does. List chunks are compared by name only.
