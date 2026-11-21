# Log: row-list-exports

- Base ca4ac0e (batch/core), tests added without the fix: pnpm --filter idlip exec vitest run test/compiler/view/codegen. Result: 2 failed, 37 passed. The row group chunk has a<id> but no l<id>; the nested case has no l exports.
- Fix in emitGroupChunk: after own and covered bindings, walk each binding list chain and emit the l binding of each list not already in the chunk.
- Branch: 42 tests in the codegen folder, 230 in the package. Golden fixtures unchanged. Review follow-up: addListExports helper, byId built once in ChunkContext, tests for equal l code, two lists in one group, no duplicate l.
