# Outcome: commands-subs

## Built

- `packages/idlip/src/client/subs/index.ts`: `startSubs`, `restartSub`. One union per marker: `idle`, `running`, `stopping`. Stop aborts the signal, calls `return()` unawaited, drops later yields. Dev warns when `return()` is not settled after 1000 ms. Delivery is pull-based through `QueuedEvent.done`.
- `packages/idlip/src/compiler/view/codegen/subscribe.ts`: the `source=<name>` chunk and the key binding. `plan.ts`, `html.ts`, `chunks.ts` and `index.ts` plan the marker block, write it and add `manifest.sources`.
- `resume.ts`: starts the subscriptions behind `HAS_SUBS`, calls `done` after a batch patched or a chunk failed, and skips an event whose `signal` aborted.
- Flag `HAS_SUBS` in `src/client/features.ts` and `src/vite/features.ts`.
- `contracts/compiled-format-subscribe.change-request.md`.
- Tests: `test/client/subs/` (clock, resume, one in flight, key restart, rows, stop and warning, build) and `test/compiler/view/codegen/subscribe.test.ts`.

## Deviations

- Edited outside owned and shared paths: `src/vite/chunks.ts` (`source` kind in `CHUNK_QUERY` and `listChunks`), `src/vite/features.ts` (detector, as the brief says), `src/testing/index.ts` (`restartSub` in the chunk scope of `mount`).
- The marker sits in its own `<!--c<id>:s-->` block instead of a bare `<template>`, so the existing block hooks start and stop it, also in rows.
- `QueuedEvent` gains `signal` besides `done`, so a value queued behind a removal does not run.
- The dev warning on a non-serializable payload (debate item 6) is deferred: values are not checked.

## Stubs left

- A `<Subscribe>` in a child component resolves its chunk against the root's manifest; `nesting-runtime` must fix that.

## Gotchas

- Loader gzip -9 (e2e method): todo 3944 B (budget 4096 B). App with a `<Subscribe>`: 4881 B, +937 B for the feature. The source chunk is 379 B and imports no shared chunk, also when it imports `timer` from `idlip`.
- A failed chunk load calls `done`, so the next value retries the load.
- A state field named `rows` clashes with the server's list accumulator `rows$`.
- `<template>` is not valid inside `<svg>`.

## Proposed learnings

- A new loader hook that needs list rows should ride on a block comment | rows have no `onBlock` hook | packages/idlip/src/client | no

## Verification

- `pnpm --filter idlip test`: 520 passed (before the build test was added; the fast check passes).
- `pnpm build && pnpm --filter e2e test`: 10 passed.
- `pnpm typecheck`, `pnpm format:check` clean.

## Size

- Estimated M, actual M.
