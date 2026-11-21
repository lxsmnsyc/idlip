# Change request: compiled-format v10, `<Try>` regions

- From node: errors
- Status: applied on 2026-11-21 by the curator, from the code on `batch/core`

## Problem

v10 reserves the `fallback` manifest field and "boundary markers around each `<Try>` region" but fixes neither the marker, the chunk, the reset message nor what the catch view can read. `errors-client` needs all four to swap a region.

## Proposed change

- **Region marker.** `<!--e<id>:<state>-->…<!--/e-->`. `<id>` is unique in the module and counts regions in view order from 0, on its own counter, so a `<Try>` does not change the ids of lists, conditions, events or subscriptions after it. The `e` prefix keeps it apart from other markers. `<state>` is one explicit union: `0` the body is rendered (ok), `1` the catch view is rendered (failed). A region inside a condition, a `<For>` row or another region's body nests like any block. The marker has no element, no `i-a` and no binding of its own: the loader finds a region by walking up from a failed node to the nearest `e` comment, and finds the end with the same depth count as `findEnd$`, over `e` instead of `c`. The loader flips the state digit when it swaps.
- **Manifest.** `fallback?: Record<string, string>`: the region id, as a string, to the chunk `try=<id>`. Absent when the view has no `<Try>`. The file name is `try.<id>.js`, the chunk id is `<module>?idlip-try=<id>&lang.js`, and `listChunks` and the server `chunks` map include it. `HAS_ERRORS` is on when `fallback` exists.
- **Fallback chunk.** Exports `render(error, scope)`, returning the catch view as HTML without the region markers, as a list chunk's `render` does. `error` is a string. `scope` is `{ model, props, rows }` (only the names the view reads), where `rows` holds the rows around the region, outermost first, the same as a binding chunk's scope. The state the catch view reads is the current model when the runtime swaps.
- **What the catch view reads.** State, props, the rows around the region, and `error`. `error` is the name and message only: `error instanceof Error ? error.name + ': ' + error.message : String(error)`, with no stack. The server renders the same string, so the page and a later client swap agree. The stack and the error object never reach the state script. The catch view is rendered once and is not patched: its holes have no bindings and no `<!--t-->` markers, so it does not follow later model changes until a swap renders it again. It may hold elements, text, holes and conditions. A `<For>`, a child component, a `<Subscribe>` or a `<Try>` in it is the compile error `try-catch-node`.
- **`reset`.** `reset` is an event target. An element with `on:click={reset}` renders `on:click='["$reset",[<id>]]'` (modifiers as the third item, like any message). `$reset` is a reserved tag: it has no `handlers` entry and no handler chunk. The runtime resolves the region from the clicked element (the nearest `e` marker, which is state `1`), loads the body again from the current model and flips the state to `0`. The id in the payload is the region's id, so the runtime can check it. The event name is listed in `manifest.events`.
- **Body.** The body keeps its bindings. When a binding inside a region throws, the runtime swaps the region to `1` with `render(error, scope)` of `fallback[id]`. When the body is rendered again, bindings inside it find their nodes again.
- **Server.** The body is built in a `try` block. When a hole, a helper or a child throws, the catch view takes its place under the marker with state `1`. Nothing of the body is written. A throw inside the catch view itself is not caught.
- **Client templates.** A condition branch or a list row template that holds a `<Try>` builds the region the same way, with the catch view inlined, so a region added by a patch can come up in state `1` too.
- **Events.** The loader's delegated listener needs the event types of a catch view (`click` for `reset`): `manifest.events` lists them.

## Affected nodes

`errors-client` (marker, `$reset`, `fallback`, `HAS_ERRORS`), `deploy-skew` (`idlip:error`), `markup-compile` (the DSL block must lower to the same `try` node).

## Workaround in place

Implemented in `src/compiler/view/codegen/` (`html.ts` `addTry`, `chunks.ts` `emitTryChunk`, `plan.ts`), `src/core/format.ts` (`Manifest.fallback`) and `src/vite/chunks.ts` (the `try` kind). Fixture: `packages/idlip/test/fixtures/try/`.

## Decision

Applied in v11 from the landed code.
