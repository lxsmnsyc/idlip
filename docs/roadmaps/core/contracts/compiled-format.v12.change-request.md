# Change request: compiled-format v11 to v12

- From node: perf-ssr-state
- Status: applied

## Problem

The state script carries what the loader never reads. In the dashboard (50 child modules) the child manifests hold `events`, `listens`, the `writes` of each handler and `view`, and the chunk map holds the `view` chunk URL of each child. Measured: dashboard state script 75,741 B, 10,450 B of it removed by this change (gzip 5,642 to 4,815).

## Proposed change

- Type: `PageState.modules` is `Readonly<Record<string, ChildManifest>>`. `ChildManifest` is `Omit<Manifest, 'events' | 'listens' | 'view' | 'handlers'>` with `handlers` entries that omit `writes` (exported from `core/format.ts`). The loader fills `events: []` where a `Page` needs a `Manifest` (`nesting.ts`).
- Contract text, State script (lines ~150-156): "`chunks` is the chunk URL map for the modules rendered on the page, and only those; the `view` chunk of a module in `modules` is left out, since a template chunk imports it by id." and "`PageState` also holds `slots`, `dynamic` and `modules`".
- Contract text, Nested components, State script and Server (lines ~372-378): "`modules` holds the manifests of the child modules and of what they can render, without `events`, `listens`, `view` and the `writes` of each handler. `render()` takes the root's `context.state` call, turns the calls with a path into `slots` and merges `chunks`, `modules` and event types." The root manifest is written whole.
- Key order of the state: `manifest, chunks, model, props, slots, dynamic, modules`. `slots` and `dynamic` now come before `modules` for every root with children, not only the nested golden.
- Not proposed here, the next step: key the chunk map by module, then chunk name. It is about 17 kB of the remaining 37 kB raw on the dashboard and touches every golden and the loader.

## Affected nodes

- `server/preload.ts` reads `listens` from the server modules' manifests, not from the state, so it is unaffected.
- The nested client (`src/client/nesting.ts`) reads `PageState.modules` and fills `events`.
- Any node that reads `test/fixtures/nested/**`, `test/fixtures/reference.ts` or the state of a page with children.

## Workaround in place

`src/server/render.ts` writes the new shape. `test/fixtures/reference.ts` (`toClientManifest`), `nested/board/expected/page.html` and `fixtures.test.ts` follow it.

## Decision

Accepted by the orchestrator on 2026-11-21 after the fresh review of `perf-ssr-state`. Applied as `compiled-format` v12. The chunk map re-keying is not part of it.
