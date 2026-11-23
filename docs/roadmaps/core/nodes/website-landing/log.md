# Log: website-landing

- Branch `node/website-landing` from `batch/core`. Cherry-picked `cb6c371` (adds `@twinkleplop/html`), which the branch lacked.
- Orchestrator change: no REPL links on the landing page. Items 3 and 7 use the diagram as the demo and a static sample in one `.landing-sample` container, for the `docs-live` node to replace.
- Orchestrator added items 14 (highlight the diagram's server HTML) and 15 (code label and Copy button over the first line of a docs code block).
- The headline reads the flat cost through `readFlatCost` in `src/landing/benchmarks.ts`, the same 10% rule as `writeLead`.
- The sample is the counter of the REPL. `SAMPLE_SOURCE` in `src/landing/sample.ts` is the one place the source lives. A test compiles it and checks it equals the REPL counter.
- `src/site.ts` no longer reads `examples/todo` for the landing page.
- Share image `website/public/og.png` was made once from an HTML file with Chromium and committed. Its numbers are fixed in the picture.
- Checked in Chromium against `vite preview` at 1440 px: hero, chart (bars grow on scroll), diagram code, sample, facts, final CTA, benefit cards, docs code block. No page errors.

## Loader size range (user feedback on the hero number)

- Method: bundle `packages/idlip/dist/client/index.js` with Vite (default minify), `define` every `__IDLIP_HAS_*__` flag of `packages/idlip/src/vite/features.ts` (TASKS, KEYED, REFS, CHILDREN, SUBS, HEAD, ERRORS, RETRY, DYNAMIC) and `__IDLIP_HAS_SKEW__`, then `gzip -9` the output. Throwaway script in the scratchpad, nothing committed.
- No flags, skew off: 9,793 B raw, 3,881 B gzip. This equals the demo loader, so it checks the method.
- No flags, skew on: 9,921 B raw, 3,941 B gzip.
- Every flag, skew off: 19,777 B raw, 7,281 B gzip.
- Every flag, skew on: 19,905 B raw, 7,336 B gzip.
- Range shown on the page: 3.9 to 7.3 kB. The earlier note that `skew` explains 3.9 vs 4.7 kB was wrong: `skew` adds about 60 B. The features the dashboard turns on explain the rest.
- Hero headline changed to "Your app grows. Its startup JavaScript doesn't." The chart heading is now "JavaScript before the page is ready, by app size". `og.png` was redone with the new headline.
