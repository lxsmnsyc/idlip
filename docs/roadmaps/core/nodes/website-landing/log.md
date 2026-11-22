# Log: website-landing

- Branch `node/website-landing` from `batch/core`. Cherry-picked `cb6c371` (adds `@twinkleplop/html`), which the branch lacked.
- Orchestrator change: no REPL links on the landing page. Items 3 and 7 use the diagram as the demo and a static sample in one `.landing-sample` container, for the `docs-live` node to replace.
- Orchestrator added items 14 (highlight the diagram's server HTML) and 15 (code label and Copy button over the first line of a docs code block).
- The headline reads the flat cost through `readFlatCost` in `src/landing/benchmarks.ts`, the same 10% rule as `writeLead`.
- The sample is the counter of the REPL. `SAMPLE_SOURCE` in `src/landing/sample.ts` is the one place the source lives. A test compiles it and checks it equals the REPL counter.
- `src/site.ts` no longer reads `examples/todo` for the landing page.
- Share image `website/public/og.png` was made once from an HTML file with Chromium and committed. Its numbers are fixed in the picture.
- Checked in Chromium against `vite preview` at 1440 px: hero, chart (bars grow on scroll), diagram code, sample, facts, final CTA, benefit cards, docs code block. No page errors.
