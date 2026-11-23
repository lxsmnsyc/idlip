# Log: docs-benchmarks

- 2026-11-23: wrote `website/docs/benchmarks.md` from `benchmarks/README.md` (run at `ed831e4`, no rerun). Section Tools, order 91.
- Changed the header "Benchmarks" link in `website/src/layout.ts` from `#benchmarks` to `docs/benchmarks/`.
- `findBenchmarksLink` needed no change: it matches `benchmarks.md`. The landing chart "All results" link now builds to `/docs/benchmarks/`.
- Did not touch `website/src/benchmarks.json` (perf-from-bench already holds the same run).
