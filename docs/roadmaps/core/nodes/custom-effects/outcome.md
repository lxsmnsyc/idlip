# Outcome: custom-effects

## Built

- `packages/idlip/src/compiler/update/segments.ts`: `findAwaitSites` finds each `await` and checks where it is. `splitSegments` writes the body of the handler's first function and of each continuation.
- `packages/idlip/src/compiler/update/tasks.ts`: `isBuiltinTask`, `getTaskChunk`, `emitBuiltinTask`, `emitTaskRun`.
- `handlers.ts` (shared): `compileHandler` returns `{ code, tasks }`, and `compileHandlers` puts the task chunks in `client` after the handler chunk. `handler-await` is gone. A sync handler gives the same bytes as before (the counter and todo goldens pass unchanged).
- `emit.ts` (shared): `EmitOptions.replacements` writes a node as given text (the `await` becomes `$outcome.value`).
- `codegen/index.ts` (shared): `manifest.handlers[<continuation tag>]` has the chunk of its handler, `manifest.tasks` is added when a handler awaits, and the server `chunks` map lists each handler chunk once, then the task chunks.
- `core/format.ts` (shared): `Manifest.tasks?` and updated `Task` comments. `vite/chunks.ts` (shared): the `task` kind in `parseChunkId`, and `listChunks` includes the task chunks.
- Fixture `packages/idlip/test/fixtures/effects/` with golden server, page, manifest, handler chunks (`add`, `persist`, `rename`) and task chunks (`task.add$1.js`, `task.persist$1.js`, `task.rename$1.js`, `task.rename$2.js`). `fixtures.test.ts` runs it with the counter and the todo. `test/compiler/update/effects.test.ts` has the golden, semantics, task chunk, built-in and error tests.
- Change request `contracts/compiled-format-tasks.change-request.md`, status open: the orchestrator applies it before `run-tasks` integrates.

### Chunk shape, for `run-tasks`

```js
export function persist(model, [props$step]) {
  let { todos, save, label, saved } = model;
  save = { state: 'saving' };
  try {
    return {
      model: { ...model, save, label, saved },
      task: { site: 'persist$1', args: [todos], then: 'persist$1', carried: [props$step] },
    };
  } catch (error) { save = ...; }
  label = 'done';
  return { ...model, save, label, saved };
}
export function persist$1(model, [$outcome, props$step]) {
  let { todos, save, label, saved } = model;
  try {
    if (!$outcome.ok) { throw $outcome.error; }
    ...try block after the await...
  } catch (error) { ...catch block... }
  ...code after the try...
}
```

- Payload of a continuation: `[outcome, ...carried locals, ...props values]`. The locals are `segments[n].carried`. The props values (`props$step`) are the props that this or a later segment reads, in the order of the handler's payload. Only the first segment gets props at render, so they ride in the task's `carried` after the locals. `task.carried` is the next continuation's payload without the outcome.
- `task.site` equals `task.then`, the continuation tag. `task.args` are the call arguments, evaluated in the segment before the `await`.
- A rejection outside a `try` arrives as `{ ok: false, error }`. The continuation throws it as its first statement, so the loader catches and reports it. Inside a `try` the throw is the first statement of the `try` block, so the `catch` runs.
- Each segment function reads the model again (`let { ... } = model`), so state after an `await` is the model at that moment. Derived values are computed from it too.
- `manifest.tasks[site]` is `task=<site>` for an import or a module function, else the handler chunk for a built-in. The task chunk exports `run(...args)` and copies the import, or the module function with its helpers. A built-in is a function `task$<site>(...args)` in the handler chunk: `Random.id` is `crypto.randomUUID()`, `Random.number` is `Math.random()`, `Time.now` is `Date.now()`, `Time.sleep(ms, signal)` waits with a timer and rejects on abort. A site is built in when the callee text is one of those and the root name is imported from `idlip`. `stock-sources` may replace the bodies.
- The handler chunk imports nothing that only an awaited call uses, so a click loads no task chunk until `runTask` needs it.

## Deviations

- Outside owned paths, to keep the tests consistent: `test/compiler/update/handlers.test.ts` (removed the `handler-await` test) and `test/compiler/view/codegen/codegen.test.ts` (continuation entries point to the handler chunk, `tasks` added). Each change touches one test of another node.
- The fixture awaits `makeId()` from `api.ts`, not `Random.id()`, because `idlip` has no `Random` export before `stock-sources`. `Random` and `Time` are covered by inline sources in `effects.test.ts`.
- The rule `handler-await` is no longer reported. `view-ir.md` still lists it. New rule ids, all errors: `await-nested` (an await in a catch or finally block, in a block, or in a nested `try`), `await-multiple` (two awaits in one statement), `await-finally` (an await in a `try` that has a `finally`), `await-handler` (a called handler awaits, or a handler awaits and calls itself).

## Stubs left

- Built-in bodies in `tasks.ts` are plain, with no seeding. `stock-sources` owns the real ones.
- `src/client/loader/resume.ts` still throws `idlip: tasks are not supported` on a step. `run-tasks` replaces it.

## Gotchas

- An `await` in the middle of an expression is lifted: the `await` is replaced with `$outcome.value` in the continuation, and the rest of the statement runs there. A read before the `await` in the same statement reads the model after it, not before. `todos = [...todos, await f()]` therefore does not lose a concurrent write.
- The first segment is wrapped as `try { ...; return step } catch`, so a throw before the `await` reaches the `catch` too. Every segment in a `try` region repeats the `catch` block and the code after the `try`.
- Tag names have `$`, so chunk files are `task.persist$1.js`.
- `handler=persist$1` is not a chunk. Use `manifest.handlers[tag].chunk`.
- Props read by called handlers are carried in every continuation, since the called handlers are copied into every segment function.

## Proposed learnings

- Test emitted chunks by importing the golden files and calling the exports | catches a continuation that reads a local it was not given | `packages/idlip/test/compiler/update` | yes (`effects.test.ts`)

## Verification

- `pnpm --filter idlip exec vitest run test/compiler/update test/fixtures test/vite` (the brief's `verify`): 96 passed.
- `pnpm --filter idlip test`: 386 passed. `pnpm --filter idlip typecheck`: clean.
- `pnpm exec oxlint --type-aware`: no errors outside `examples/todo`, which this node does not touch. `pnpm format:check`: only `nodes/custom-effects/brief.md`, which was unformatted before.
- The counter and todo fixtures have no diff.

## Size

- Estimated M, actual M.

## Landing

Landed as 71ab858 on `batch/core` after one clean fresh review. Accepted changes outside owned paths: `test/compiler/update/handlers.test.ts`, `test/compiler/view/codegen/codegen.test.ts`. The task change request is open until the curator applies it.
