# Outcome: global-events

## Built

- `packages/idlip/src/core/dev.ts`: `DEV` (`process.env.NODE_ENV !== 'production'`), `DEEP_QUEUE` (20) and `warnDeepQueue(queue, event)`. The warning names the event and suggests `latest:`. It fires once per burst, when the event is the 20th pending one for its element and type.
- `resume.ts`: `enqueue` calls `warnDeepQueue` behind `if (DEV)`, three lines plus the import.
- Tests in `test/client/global/`: `global.test.ts` (window `keydown` stops after its branch is removed and returns with it; `latest:pointermove` keeps the last event while `on:input` keeps every value; the warning at 20 queued clicks, once, naming `click`; none at 19) and `build.test.ts` (client build with the real loader).
- Dev flag choice: `NODE_ENV`. Vite replaces `process.env.NODE_ENV` in every module of a client build, dependencies included, so no `DETECTORS` entry and no manifest are needed. The build test sets `NODE_ENV` per build: the production loader has no warning text, the development one has it.

## Deviations

- None. The `window`, `document` and `latest:` behavior already existed; the tests only prove it.
- `dev.ts` reads `process` directly, so an unbundled loader in a browser would throw. The Vite plugin is required for idlip apps, so this is not a supported case.

## Stubs left

- None.

## Gotchas

- The test runner sets `NODE_ENV=test`, and Vite takes the process value first, so a build test must set `process.env.NODE_ENV` itself.
- The `DEV` test must stay in this exact form (`DEV` imported and used in `if (DEV)`) so the bundler folds it.

## Proposed learnings

- Put dev-only code behind `if (DEV)` from `core/dev.ts` | a production build folds `DEV` and drops the code and its text | packages/idlip/src | yes

## Verification

- `pnpm --filter idlip exec vitest run test/client/global`: 6 passed.
- Production loader for the todo build, as the e2e budget test measures it: 3913 B gzip -9 (budget 4096 B). `pnpm --filter e2e test`: 10 passed.
- Full check: see the final report of the worker.

## Size

- Estimated S, actual S.
