# Inbox

Ideas and findings parked for later triage.

- 2026-11-21, from `spike-chunk-merge`: `loadBindings` in `packages/idlip/src/client/patch/patch.ts` runs every function a loaded chunk exports, not only the bindings of the changed group. Harmless with one group per chunk; a merge threshold would need to restrict it to `manifest.groups[key].bindings`.
- 2026-11-21, from `spike-chunk-merge`: the bench harness reads the todo count with `/(\d+) left/` over the page body and reads "32" when the last title runs into the count. Read `ul + p` instead (`benchmarks/harness`).
- 2026-11-21, from `markup-example`: type-aware oxlint does not read `.idlip` files.
