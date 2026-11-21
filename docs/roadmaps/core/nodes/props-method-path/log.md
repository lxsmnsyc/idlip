# Log: props-method-path

- Base proof at e0ae57e (batch/core), `pnpm --filter idlip exec vitest run test/compiler` with the three new tests: 3 failed, 119 passed.
  - handlers.test.ts: chunk was `find(model, [props$list$indexOf, props$list, by])` instead of `[props$list, by]`.
  - analyze.test.ts: path was `props.list.indexOf`, not `props.list`.
  - analyze.test.ts: text `&lt;` and the others stayed undecoded.
- Fix: `recordProps` takes a `called` flag; a member that is the callee of a call drops its last name. `props.onSave()` keeps its name (the props object has no methods).
- `handler-props-unlisted` error added. Probes (`props['list']`, destructuring, `??`, `?.`) all list a path, so no source reaches it; it is a safety net with no test.
