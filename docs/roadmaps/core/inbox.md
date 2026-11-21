# Inbox

Ideas and findings parked for later triage.

- 2026-11-21, from `spike-chunk-merge`: `loadBindings` in `packages/idlip/src/client/patch/patch.ts` runs every function a loaded chunk exports, not only the bindings of the changed group. Harmless with one group per chunk; a merge threshold would need to restrict it to `manifest.groups[key].bindings`.
- 2026-11-21, from `spike-chunk-merge`: the bench harness reads the todo count with `/(\d+) left/` over the page body and reads "32" when the last title runs into the count. Read `ul + p` instead (`benchmarks/harness`).
- 2026-11-21, from `markup-example`: type-aware oxlint does not read `.idlip` files.
- 2026-11-21: `test/client/nest/nest.test.ts` (client-added row, same-key row) failed twice under load and passed on rerun (seen by `prefetch` and an earlier reviewer). Needs a flake hunt like `fix-flaky-tests`.
- 2026-11-21, from `prefetch`: decide whether `examples/todo` and the GOAL acceptance ("nothing loads before the first event") should use prefetch by default. It cuts the cold first click from 221 ms to 60 ms but loads two chunks before any event.
- 2026-11-21, from the wave 9 curator: no nodes yet for `Step.send` (in the contract, not built), tracked dynamic holes inside rows, branches and children (they use static fallback paths), and a `HAS_KEYED` detector that reads handler `writes`.
- 2026-11-21, from debate `debates/dsl`: look for a TSX-side fix to the `let x = v satisfies T as T` workaround (TS narrows an initialized `let`, TS2367).
- 2026-11-21, from `docs-start`: a function assigned to a `let` compiles with no diagnostic, though `docs/proposals/0002-modules.md` says it is a compile error. Needs an analyzer rule or a proposal fix.
- 2026-11-21, from `docs-start`: `website/docs/getting-started.md` installs from `pnpm --filter idlip pack` because npm `idlip` is a `0.0.1-stage` placeholder. `release-0-1` should switch it to `pnpm add idlip`.
- 2026-11-21, from `docs-start`: `website/docs/views.md` mentions the effects page without a link; `docs-effects` should add it.
- 2026-11-21, from `docs-reference`: `contracts/view-ir.md` v11 does not list rule ids the compiler reports (`attr-event`, `html-element`, `srcdoc-trusted`, `head-title-twice`, `try-catch-node`, `handler-props-unlisted`, `codegen-*`) or the warning `handler-derived-stale`. Sync the contract with the source. No editor support exists on `batch/core` (no `packages/vscode`, no TS plugin).
- 2026-11-21, from `bench-rows`: dashboard client JS is 3.1x and 11.7x gzip behind (about 7 small chunks per widget; module-level helpers copied into each chunk that uses them). Rows SSR HTML is +31% raw from per-row markers (smallest in gzip). Not taken up by `perf-from-bench`.
