# Log: compile-update

- Built `src/compiler/update/` (emit.ts, handlers.ts, index.ts) and `test/compiler/update/handlers.test.ts`.
- Golden fixtures for counter and todo match byte for byte.
- Fixed one bug on the way: edits shift offsets, so protected template-literal ranges are mapped through the applied edits.
- Checks pass: tests 139, typecheck, format, oxlint (existing warnings only).
