# Outcome: docs-benchmarks

## Result

`website/docs/benchmarks.md` exists (section Tools, order 91). The numbers are from the 2026-11-23 run at `ed831e4`, copied from `benchmarks/README.md`. No benchmark was rerun.

- Sections: the run, what is measured, startup and first click (with preload links on and off), rows, dashboard, scale, reading (wins, total bytes growth, losses with design and code costs), caveats, repeat it.
- The landing chart "All results" link and the header "Benchmarks" link both point to `/docs/benchmarks/`.

## Changes outside the owned paths

- `website/src/layout.ts`: the header link target.

## Not done

- The landing foot and lead corrections from `bench-scale` (say "JavaScript", fix "Qwik 1 ran only on the smaller app") are not part of this node.
- `website/src/benchmarks.json` unchanged, it already holds this run.

## Verification

- `pnpm --filter website build` (29 pages), `test` (135 passed), `check:samples` (0 problems), `check:reference` (0 problems).
- `rtk proxy pnpm lint` exit 0 with existing warnings. `pnpm exec oxfmt --check .` clean.
- Prose checker: 5 long-sentence warnings, no errors.
