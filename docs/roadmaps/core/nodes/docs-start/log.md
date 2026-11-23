# Log: docs-start

- Started from `batch/core` at 0e596c0. No pages existed; `website/docs/` held only `index.md`.
- npm `idlip@0.0.1-stage` (2026-11-18) exports only `.`, so the getting-started page installs a tarball from `pnpm --filter idlip pack`.
- Ran the getting-started steps in an empty folder outside the repo: `pnpm init`, the tarball, `vite` and `typescript`, the four files. `tsc` passed. `vite` dev served the page. A Playwright script clicked the second checkbox (`1 left` to `0 left`) and submitted a new todo (3 rows), with no console error or warning. `vite build` passed.
- Probed every rule id the pages name by compiling small modules with `compile` from `idlip/compiler`. A function assigned to state compiles with no diagnostic, so the components page does not claim an error for it.
- `pnpm lint` exits 1 through the `rtk` wrapper only. `rtk proxy pnpm lint` and `./node_modules/.bin/oxlint --type-aware` exit 0.
