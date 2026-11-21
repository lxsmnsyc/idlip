# Change request: compiled-format v10 to v11

- From node: custom-effects
- Status: open

## Problem

v10 reserves `manifest.tasks` and says `task.site` names the awaited call, but not how a site is named or where its code lives. The `Task` type comment says `persist:0`, which has a `:` that file names and chunk ids should avoid. There is no chunk kind for an awaited function, so `vite/chunks.ts` rejects it.

## Proposed change

- `task.site` is the continuation tag, such as `persist$1`. It is unique per handler and has no `:`. `task.then` has the same value.
- A new chunk kind `task=<site>`, such as `task=persist$1`, with the file name `task.persist$1.js` and the id `<module>?idlip-task=persist$1&lang.js`. It exports `run(...args)`, which calls the awaited function and returns its promise. The chunk copies the import or the module-level function it needs, with the helpers that function reaches.
- `manifest.tasks` maps a site to its chunk. It is absent when no handler awaits. For a built-in site (`Random.id`, `Random.number`, `Time.now`, `Time.sleep`, imported from `idlip`) the value is the handler chunk, `handler=<name>`, which exports `task$<site>(...args)` (`task$add$1`). Built-ins load nothing extra.
- A continuation tag has a `manifest.handlers` entry whose `chunk` is the handler's own chunk (`handler=add`), not `handler=add$1`.
- The payload of a continuation is `[outcome, ...carried]`. `carried` lists the locals of `segments[n].carried` in order, then the props values (`props$step`) that the continuation or a later one reads, in the order of the handler's payload. Continuations have no render-time props otherwise.
- `vite/chunks.ts` accepts the `task` kind, and `listChunks` includes the chunks of `manifest.tasks`.
- A rejected task outside a `try` arrives as `{ ok: false, error }`. The continuation throws it, so the loader reports it.

## Affected nodes

`run-tasks` (loader and `runTask`), `compile-integration`, `vite-plugin`.

## Workaround in place

None needed: `custom-effects` implements the change as written. `Task.site` keeps its type.

## Decision

Filled in by the orchestrator.
