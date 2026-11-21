# Change request: compiled-format v10, client errors

- From node: errors-client
- Status: applied on 2026-11-21 by the curator, from the code on `batch/core`

## Problem

`compiled-format-errors.change-request.md` fixes the region marker and the catch chunk, but not what `reset` loads to render the body again, and `deploy-skew` needs one event shape for failures.

## Proposed change

- **`try=<id>` chunk.** Besides `render(error, scope)` it exports, when the catch view uses `reset`, `region(scope, start)`: the whole region with its markers, built as the server builds it (body in a `try` block, catch view inlined on a throw). `reset` replaces the region with it. If the body still throws, the result is state `1` with the new error. `scope` is `{ model, props, rows, path }`; `start` is the region's start comment.
- **Rows on reset.** A `reset` has no binding scope. A region inside a `<For>` reads its rows in the chunk: the helper `getRows$(start, model, lists$)` walks the `i` and `l<id>` markers and resolves each row's item from the `each` path of the list. A list whose `each` is not a path cannot be reset: the reset reports an error. The loader passes `rows: []`.
- **`idlip:error`.** A `CustomEvent` on `document`, `detail: { error, path }`. `error` is the thrown value as is (not the string of the catch view). `path` is the model path of the component, `''` for the root. It fires once for each of:
  - a binding that throws inside a `<Try>` (after the swap);
  - a handler that throws, with the model kept;
  - a chunk that fails to load after the retry;
  - a failed patch (including a binding chunk that fails to load).
    The event is behind `HAS_ERRORS`, so an app without `<Try>` gets none.
- **Retry rule.** Behind its own flag `HAS_RETRY`, which `deploy-skew` may turn on without `<Try>`. `load` imports a failed chunk once more at once, under the URL plus `#r<n>`, where `n` counts the earlier failed loads of that URL. A second failure rejects, which the loader reports. The next event with the same tag still tries again under `#<n>`, as before.
- **Children.** The search for a region stops at an `n:` boundary, so a child's binding never swaps a parent's region.
- **Testing.** `idlip/testing` `settled()` rethrows an error a region caught, unless `mount` gets `expectCaught: true`.
- **Errors outside a `<Try>`.** A binding that throws with no region around it is rethrown to the loader: `console.error` and `onError`, as before.
- **Failed-state bindings.** Nodes of the replaced body are gone, so the bindings of a failed region find no node and are skipped until a reset renders the body.

## Affected nodes

`deploy-skew` (listens to `idlip:error`), `markup-compile` (the DSL block emits the same chunk exports).

## Workaround in place

`src/compiler/view/codegen/chunks.ts` `emitTryChunk` writes `region`; `src/client/errors.ts` is the runtime.

## Decision

Applied in v11 from the landed code.
