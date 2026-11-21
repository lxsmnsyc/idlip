# Log: compiled-format

- Branch `feat/compiled-format` reset to `batch/core` (80099c2). Nothing of this node existed yet.
- Read GOAL, brief, view-ir v8, core-api v7, the draft contract, both spike outcomes and brumate's `docs/compiler.md` and `website/docs/page-format.md`.
- Decision: the todo fixture is synchronous. `compile-update` rejects `await` until `custom-effects`, so a fixture with `await` would fail its acceptance. Ids come from a `next` counter in state. The format still defines `Step` and `Task` for async handlers.
- Decision: the chunk of a group also patches the groups it implies (`covers`). Toggling a todo changes `todos` too, and `{left}` reads `todos`, so without this the first click would load two binding chunks instead of the one the GOAL counts.
- Decision: list rows carry no keys in the DOM. The old model's list gives the row order.
- Review round: rebased onto `batch/core` (jsx-types, compile-view-analyze, core-api v8). `diffPaths` pairs `*` under a keyed `<For>` by key (stale rows on reorder). Chunk URLs fixed: root-relative module ids, `&lang.tsx` chunk ids, `chunks` map in the state record. Dedup of bindings per patch, nested list rule, non-bubbling events match the target only, `event-passive-prevent`. Removed the fixture JSX pragma and `test/fixtures/jsx/`.
- Decision: the listener is a separate inline script in `<head>`, not part of `render()` output, so the fixture HTML does not pin runtime code. Needs `renderListener` in `idlip/server` (core-api change request).
- Review round 2: a `*` path under a keyed list changes when it differs by key or by index, so `todos[selected].done` outside rows patches after a reorder. Chunk ids end in `&lang.js`.
