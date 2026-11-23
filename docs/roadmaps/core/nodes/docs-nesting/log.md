# Log: docs-nesting

- Reset to batch/core (b4e5911). Built idlip. No nesting page existed.
- Probed `compile` on the `examples/counters` modules as `/sample.idlip.tsx`: no diagnostics, so both are `tsx` samples.
- Rendered the built counters server entry to get the boundary markers, message props and the slots table.
- Probed a child handler that calls `props.onDone()`: error `handler-props-unlisted`, with an empty path in the message. Probed `key="left"` outside a loop: `slot$(path, 0, 'left')`.
- Wrote `website/docs/nesting.md`, order 20. check:samples 36/0, build 20 pages, check:reference 94/0, prose ok, oxfmt ok.
- Full check: build, lint, format:check, typecheck, test (659) pass. e2e failed first on port 4173, held by another worktree. Rerun with `E2E_PORT=4573 E2E_COUNTERS_PORT=4574 E2E_SUBS_PORT=4575`: 18 passed.
