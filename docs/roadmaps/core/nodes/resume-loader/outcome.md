# Outcome: resume-loader

## Built

- `packages/idlip/src/client/loader/listener.ts`: `renderListener({ nonce })` returns the inline `<script>` for `<head>`. Hand-written, one document listener per event type in each state record. It:
  - walks from the target outwards (bubbling events) or matches `event.target` only (`focus`, `blur`, `mouseenter`, `mouseleave`, `pointerenter`, `pointerleave`, `load`, `error`, `scroll`, in a capture listener);
  - reads `i-global` templates for `window` and `document` listeners;
  - applies the key filter first, then `prevent`, `passive`, `once`, `capture`, `stop`, and marks `latest`;
  - resolves `["$event", ...]` (with `currentTarget` as the element that carries the attribute) and `["$", ...]` when the event fires;
  - pushes a `QueuedEvent` to `self.$idlip.q`;
  - treats `<type>:passive` as a passive listener;
  - catches records pushed before and after it ran.
- `packages/idlip/src/client/loader/resume.ts`: `resume(boot, patch)`. It drains `boot.q`, replaces `q.push`, and queues events. A state record is decoded on the first event of its root (the root is found by the `script[i-state]` that follows the target and whose parent contains it; its record is at the script's position). The loader imports the handler chunk from `chunks[getChunkId(module, chunk)]`, waits until every queued event has its chunk, runs the batch through `update` in order, and calls `patch(page, prev, next)` once per root. Events that arrive during a patch go to the next batch. `latest` replaces a pending event of the same element and type. A failed chunk stays queued, is reported with `console.error`, and loads again on the next event (the retry adds `#<n>` to the URL, since a browser may keep a failed import). A handler error is reported and the model stays as it was.
- `packages/idlip/src/client/index.ts`: top-level boot, `resume(self.$idlip, patch)`, and `export { patch }`.
- `packages/idlip/src/client/loader/patch.ts`: stub patcher (see Stubs left).
- Tests in `packages/idlip/test/client/loader/`: `loader.test.ts` (12) runs the counter and todo fixtures in happy-dom with the real listener, loader and fixture handler chunks, and a stub patcher. `listener.test.ts` (25) covers modifiers, key filters, placeholders, delegation, globals and the size budget. `helpers.ts` writes chunk copies that record their evaluation.

Acceptance:

- [x] `src/client/index.ts` is the loader. It builds `patch = createPatch(patchList)` and exports `patch`, `patchList`, `diffPaths`, `parseHtml`, `addBlock`, `removeBlock`, `findInnerBlocks` and `onBlock`. The stub is deleted.
- [x] Size: the built loader is 3811 B gzip -9 against 4096 B, with the real patcher and list patcher. The reviewer measured it fully minified (rolldown `minify: true`, `src/client/index.ts` as the entry). An earlier Vite library build gave 4407 B, but it was not fully minified. Listener script with tags: 974 B gzip -9 against 1024 B.
- [x] Counter click loads only `handler=increment` and calls the patcher with `{count: 4}` and `{count: 5}`.
- [x] Two clicks before the chunk resolves apply in order (the gated `add` chunk gives `{count: 24}`).
- [x] `e.currentTarget.value` decodes from an `input` event.
- [x] Three `input` events before the chunk resolves queue three messages with `a`, `ab` and `abc`, and the patch gets `draft: 'abc'`.
- [x] `prevent` applies when the event fires: a todo form submit is default-prevented while `handler=add` has not loaded.
- [x] `focus` and `blur` fire through delegation, with no outward walk.
- [x] A failed chunk keeps the event, reports, and loads again on the next event.
- [x] Several queued messages run in order and patch once (`add`, `increment`, `add` gives `{count: 25}` in one call).
- [x] `pnpm --filter idlip test`: 211 passed.

## Deviations

- The brief says the loader delegates events. The contract (`Listener and early events`) gives delegation to the early listener and has the loader take over `q`. Built to the contract. A page without `renderListener()` gets one `console.warn` and never resumes.
- The loader does not replace `$idlip.push`. The listener keeps registering the event types of later records, so the loader reads records by position and has no need to take it over.
- The listener registers two listeners per type (capture for events that do not bubble, bubble for the rest) and picks by `event.bubbles`, instead of keeping the contract's list of non-bubbling types. This covers the contract's list and custom events, and saves about 150 B gzip.
- `once` removes the attribute. The "stays removed after `setOn`" rule needs `setOn` to know. Not done here.
- `$form` placeholders pass through unresolved until `form-fields`.
- One file outside the owned paths: `src/server/index.ts` gains `export { renderListener } from '../client/loader/listener.ts';`.

## Stubs left

- `Step` results (async handlers) are rejected with an error until `custom-effects` brings `runTask`.
- `chunk-helpers` copies the DOM and render helpers into chunks. The loader does not export `setText`, `setAttr`, `setOn`, `setBranch`, `attr`, `on` or `text`.

## Gotchas

- The listener has 50 B of headroom under its gzip budget.
- A root's events run in order: events behind a failed one wait for it, and other roots continue.
- An event whose tag is unknown or whose chunk lacks the export is dropped and reported. A failed load keeps its event, and other tags run meanwhile. The next event with that tag retries it.
- The model diffs from the `rendered` model, which changes only after a patch succeeds.
- Records and state scripts pair by position: the n-th `script[i-state]` in the document is the n-th pushed record. A script removed or inserted out of order breaks it.
- Two roots in the same parent share a `Page.root`, which `patch-bindings` must handle (binding ids repeat per component, and `i-a` ids are per component).
- The listener's `once` and `capture` run in one document pass, not in a real capture phase. `capture` orders handlers outermost first, before the bubble handlers.
- Vitest's module runner cannot import from the system temp folder and caches a failed import. The tests keep chunk copies under `node_modules/.idlip-loader-test/` and remove them after each test.
- `getChunkId` is imported from `core/format.ts` into the loader. It is a one-line function.

## Proposed learnings

- Hand-minified inline scripts need a gzip test | the 1024 B budget is 8 B from the limit | packages/idlip/src/client/loader | yes, `listener.test.ts` measures it
- A handler tag read from the DOM must be looked up with `Object.hasOwn` | `toString` or `constructor` would match an object prototype | packages/idlip/src/client | yes

## Verification

- `pnpm --filter idlip exec vitest run test/client/loader` (the brief's verify): 49 passed (loader 16, listener 33).
- `pnpm --filter idlip test`: 326 passed.
- `pnpm format:check`: passes.
- `pnpm typecheck`: passes.
- `./node_modules/.bin/oxlint --type-aware`: no errors or warnings in client files. The warnings left are in `compile-view-analyze` files from the batch.

## Size

- Estimated M, actual M. The listener and its 1024 B budget took most of the time.
