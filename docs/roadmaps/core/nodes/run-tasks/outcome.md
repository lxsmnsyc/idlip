# Outcome: run-tasks

## Built

- `packages/idlip/src/client/tasks/run.ts`: `runTask(host, task)`. It loads the task chunk, calls the function, wraps the result as `{ ok: true, value }` or `{ ok: false, error }`, and delivers `{ t: task.then, p: [outcome, ...task.carried] }`.
  - A site in `manifest.tasks` loads that chunk and calls its `run(...args)`. Its continuation is pushed to `boot.q` as an event with no DOM target (the state script stands for `target`) when the task settles, so it joins the next batch. The batch does not wait for it. Every run continues (no latest-wins).
  - Any other site is a built-in: `task$<site>` exported from the chunk of the continuation's handler. The continuation runs inside the current batch, before the patch, so one patch covers the step and its continuation.
  - A chunk that fails to load rejects. The loader reports it and keeps the step's model. Later events still run.
- `packages/idlip/src/client/loader/resume.ts`: replaces the "tasks are not supported" stub with one `runTask` call in `apply`, which now also runs built-in continuations recursively. `isInside` accepts the state script itself as a target.
- `packages/idlip/src/core/format.ts`: `Manifest.tasks?: Record<site, chunk name>`.
- Tests: `tasks.test.ts` (8, hand-written chunks, built-in site listed in `tasks`, missing built-in function reported) and `effects.test.ts` (1, the compiled `effects` fixture chunks with a stub for `./api.ts`).

## Contract assumptions

Reconciled with `compiled-format-tasks.change-request.md` (custom-effects):

- `task.site` equals the continuation tag (`persist$1`) and is a key of `manifest.tasks`.
- `tasks[site]` is `task=<site>` (exports `run(...args)`) or `handler=<name>` for a built-in (exports `task$<site>`). The loader treats the `handler=` prefix as built-in. A site missing from `tasks` fails to load and is reported.
- The continuation payload is `[outcome, ...carried]`. The compiler already puts the props values (`props$step`) into `task.carried`, so the loader adds nothing.
- A step is `{ model, task }`. Handlers get the payload array as one argument.
- `runTask(host, task)` takes a host object (`page`, `apply`, `push`, `report`). The `RunTask` type is removed from `format.ts`. The contract text still lists it and should drop it.

## Acceptance

- [x] Resolve gives `{ ok: true, value }` with the carried locals. Rejection gives `{ ok: false, error }`. A failed task chunk is reported and the model stays.
- [x] A built-in (`Random.id`) patches once, after the continuation.
- [x] Two clicks give two independent continuations, settled in either order.
- [ ] Loader at most 4096 B gzip: 4342 B on the todo example build (base 4099 B by the same method, +243 B). The orchestrator expects `runtime-flags` (`HAS_TASKS`) to remove it for pages without tasks.

## Deviations

- Loader over budget, by agreement with the orchestrator (see above).
- `RunTask` is removed (see Contract assumptions).
- `resume.ts` no longer throws "returned nothing" for a handler that returns `undefined`; `isStep` throws a `TypeError`, which is reported the same way.

## Gotchas

- Custom task errors after the load (a throwing `run`) become outcomes. Errors in the continuation handler are reported and do not reach the task.
- A built-in continuation that returns another step runs its task in the same batch too.
- `settled()` does not wait for a custom task in flight.

## Verification

- `pnpm --filter idlip exec vitest run test/client/tasks test/client/loader`: 106 passed.
- `pnpm --filter idlip test`: 431 passed. `tsc --noEmit`, oxlint (client and tasks tests) and oxfmt are clean.

## Size

- Estimated M, actual M. Most time went to loader bytes.
