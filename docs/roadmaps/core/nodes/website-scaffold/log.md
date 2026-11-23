# Log: website-scaffold

- Reset to batch/core, branch `feat/website-scaffold`. No `website/` existed, so no "already fulfilled".
- Static build: Vite bundles `src/client.ts` and `styles.css` to fixed names, `scripts/build.ts` renders the pages. No hashes, no manifest.
- `pnpm install` was needed for the new package: `pnpm-workspace.yaml` and `pnpm-lock.yaml` changed.
- Compiler wants an assigned `let`: a sample with an unassigned `let` gives the warning `let-unassigned`, which the checker reports as a failure.
- Root `oxfmt --check` fails on `docs/roadmaps/core/contracts/markup-grammar.md`, not mine.
