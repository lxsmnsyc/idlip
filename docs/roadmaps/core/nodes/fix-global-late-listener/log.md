# Log: fix-global-late-listener

- Base repro (batch/core e554ee2): `pnpm --filter idlip exec vitest run test/client/global/late` gave 2 failed: window and document, count `0`, expected `1`.
- Cause as in the brief: `add()` added a global listener only when a template for the type was on the page at that time.
- First fix (dropped): add the window and document listener for every type a record names. It costs every page two listeners per type and a `querySelectorAll` per event. The orchestrator asked for a version where pages without global elements pay nothing.
- Second fix: the compiler lists a global event as `type:window` or `type:document` in `manifest.events`, so the record carries it, even for an element inside a condition. `add()` adds the global listener only for those tokens. The contract has no field for it: `contracts/compiled-format.v13.change-request.md`.
- After: `pnpm --filter idlip test` 666 passed; e2e 18 passed.
- `pnpm lint` printed "ESLint output (JSON parse failed ...)" and exited 1 only through the rtk wrapper. On batch/core (separate worktree, built) `pnpm lint` through the wrapper gives warnings, but `rtk proxy pnpm lint` exits 0 on this branch, so the error is the wrapper, not the repo.
