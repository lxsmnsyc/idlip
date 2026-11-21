# Log: commands-subs

- Reset to `batch/core`. The marker is a `<!--c<id>:s-->` block around a `<template i-sub>`, so the existing `onBlock` hooks reach it, also in `<For>` rows (rows have no hook, since `findInnerBlocks` skips `i`).
- The lifecycle is one union per marker in `src/client/subs/index.ts`: `idle` (no entry), `running`, `stopping`.
- Pull delivery uses `QueuedEvent.done`, called by `runBatch` after the patch. `signal` drops an event of a stopped run.
- A state field named `rows` clashes with the list accumulator `rows$` on the server (existing bug, not mine). Tests use `items`.
- Sizes (gzip -9, loader file): todo 3944 B. App with `<Subscribe to={timer}>` 4881 B, source chunk 379 B.
