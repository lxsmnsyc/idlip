# Change request: compiled-format, `<Subscribe>` markers

- From node: commands-subs
- Status: applied on 2026-11-21 by the curator, from the code on `batch/core`

## Problem

v10 reserves the `i-sub` marker and names a source chunk, but fixes neither the marker's attributes, how a block hook reaches it, how a `key` change restarts a run, nor how a value reaches the loader's queue. The queue has no way to ask for the next value only after a patch.

## Proposed change

- `Manifest.sources?: string[]`: the source names of the view, absent when there is no `<Subscribe>`. The chunk of a name is `source=<name>`, with the file name `source.<name>.js` and the id `<module>?idlip-source=<name>&lang.js`. It exports `source`: the async generator, with the imports and module-level code it needs. The chunk URLs gain these ids, and `listChunks` includes them. A page with no marker loads none.
- Marker: `<!--c<id>:s--><template i-sub="<name>" i-input="<json>" i-key="<json>" on:value="<DomMessage>" i-a="<ids>"></template><!--/c-->`.
  - `<id>` is unique in the module. `:s` tells the loader this block is a subscription, not a condition. The block comments let the existing block hooks (`onBlock`) start and stop it, also inside `<For>` rows, which have no hook of their own.
  - `i-input` and `i-key` are JSON, written only when the attribute exists. The input is read once at start.
  - `on:value` is a DomMessage whose payload has `["$event", ...segments]` placeholders, filled with the yielded value. It is not an event type, so `manifest.events` does not list `value`.
  - `i-a` lists the binding ids that patch the marker: the key binding, and a `setOn` binding when `on:value` reads state.
- Key binding: when `key` reads state, one `a<id>` binding on the marker calls `restartSub(el, input, key)` from `idlip/client` with the JSON text of both. The loader compares the key text with `i-key`. A different key writes both attributes, stops the run and starts another. The same key does nothing.
- Loader start: the loader starts every `template[i-sub]` in the page, and the block hooks start and stop the markers of blocks that patches add and remove.
- Interface `QueuedEvent` gains `done?: () => void`, called once the batch that ran the event has patched (or when the event is dropped or its chunk fails to load), and `signal?: AbortSignal`: an event whose signal is aborted is dropped before it runs. The subscription asks the source for its next value after `done`, so one value is in flight.
- Feature flag: `HAS_SUBS`, on when `manifest.sources` exists.

## Affected nodes

`compile-integration` (the chunk kind), `vite-plugin` (`CHUNK_QUERY` and `listChunks` accept `source`), `nesting-runtime` (a child component's markers resolve their chunk against the root's manifest for now).

## Workaround in place

Implemented in `src/client/subs/`, `src/compiler/view/codegen/subscribe.ts`, `src/core/format.ts` and `src/vite/chunks.ts`.

## Decision

Applied in v11 from the landed code.
