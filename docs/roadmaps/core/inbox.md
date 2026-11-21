# Inbox

Ideas and findings parked for later triage.

- 2026-11-21, from `spike-chunk-merge`: `loadBindings` in `packages/idlip/src/client/patch/patch.ts` runs every function a loaded chunk exports, not only the bindings of the changed group. Harmless with one group per chunk; a merge threshold would need to restrict it to `manifest.groups[key].bindings`.
- 2026-11-21, from `spike-chunk-merge`: the bench harness reads the todo count with `/(\d+) left/` over the page body and reads "32" when the last title runs into the count. Read `ul + p` instead (`benchmarks/harness`).
- 2026-11-21, from `markup-example`: type-aware oxlint does not read `.idlip` files.
- 2026-11-21: `test/client/nest/nest.test.ts` (client-added row, same-key row) failed twice under load and passed on rerun (seen by `prefetch` and an earlier reviewer). Needs a flake hunt like `fix-flaky-tests`.
- 2026-11-21, from `prefetch`: decide whether `examples/todo` and the GOAL acceptance ("nothing loads before the first event") should use prefetch by default. It cuts the cold first click from 221 ms to 60 ms but loads two chunks before any event.
- 2026-11-21, from the wave 9 curator: no nodes yet for `Step.send` (in the contract, not built), tracked dynamic holes inside rows, branches and children (they use static fallback paths), and a `HAS_KEYED` detector that reads handler `writes`.
- 2026-11-21, from debate `debates/dsl`: look for a TSX-side fix to the `let x = v satisfies T as T` workaround (TS narrows an initialized `let`, TS2367).
