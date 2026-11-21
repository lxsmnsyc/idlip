# Log: keyed-paths

- `find` lowers to a path with a `keyed` segment in `lowerFind`. Path sets decide in `collectPaths` whether it stays keyed (`isKeyedList`) or falls back to `*`.
- A `<For>` can come after the hole, so `analyze` runs a second pass when the first saw a `find` and collected `<For>` keys.
- Codegen prints `.find(($i) => $i.id === value)` and makes later segments optional. The manifest key is `todos[id=selected]`.
- `diff.ts` parses keyed segments and splits paths outside brackets.
- `pnpm typecheck` fails in `examples/todo` without a build of `idlip` (missing `dist`). Not related.
- `pnpm format:check` flags `docs/roadmaps/core/nodes/custom-effects/brief.md`, another node's file.
