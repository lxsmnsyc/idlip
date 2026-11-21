# Log: benchmarks

- Copied the harness, marko, qwik1, qwik2 and brumate-0.3 from brumate's benchmarks, then cut the dashboard and rows scenarios, promo and brand scripts.
- Added `benchmarks/idlip` (Vite setup from `examples/todo`, no CSP).
- Added `benchmarks/*` to `pnpm-workspace.yaml` and `allowBuilds: esbuild: false` for Vite 7 in qwik1.
- Verify command passed. Full run at load 4.76 (other agents running): numbers in `benchmarks/README.md`.
