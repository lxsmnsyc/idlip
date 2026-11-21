# Log: nesting-compile

- Renamed the branch to `feat/nesting-compile`, reset to `batch/core`.
- Read the change request and the nested fixtures. The IR already carries `child` nodes, message props and prop-target events, so the work is codegen only.
- Plan: `child` nodes get a site and the loops around them. Child props and message props become `p` bindings. A child module (`child: true`) reads `props.*` paths as binding paths.
- Chunk and manifest output matched the goldens on the first full run. The item template and `view` chunk goldens are hand-written with string concatenation, so they are checked by behavior, as `list.3.js` is.
- `compile()` is not edited (not owned). The test composes `compileHandlers` and `generate`, as `compile()` does.
- `$step: true` is added in `update/segments.ts` (`writeIssue`). The `effects` goldens and `effects.test.ts` follow.
- The loader's `isStep` tests `'task' in result && 'model' in result`, so a task step still passes. e2e passes.
- Lint `no-cycle` forbade `child.ts` and `chunks.ts` importing each other, so the `p` binding and `view` emitters moved into `chunks.ts`.
