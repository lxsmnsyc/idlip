# Outcome: website-landing

## For the user

The landing page now leads with the result. Hero headline: "Your app grows. Its startup JavaScript doesn't." The claim is used only while `benchmarks.json` shows idlip within 10% from the smallest to the largest app, with the plain fallback "Pages that run no view code on load." Section order: hero, resume diagram (the demo), benefit cards ("What you get"), benchmarks chart, sample, "Before you start", final call to action.

## What changed

1. Hero headline states the claim true for every app, with no bare number. The conditions line gives the measured loader range (3.9 to 7.3 kB gzip), the same from 10 to 1,000 widgets, the 991 B inline listener and what a click loads. The fallback headline stays. The hero lead now says what idlip is and for whom, and the slogan is gone. The conditions (10 to 1,000 widgets, the loader file, gzip, before `load`, and the inline listener in the HTML) sit under it with a link to the chart.
2. Install command `pnpm add idlip` with a copy button in the hero. The package is not on npm before 0.1, so the page says so under "Before you start".
3. Demo. The orchestrator removed the REPL links. The resume diagram sits right below the hero and is the demo. No REPL link on the landing page body (the header keeps its existing REPL link).
4. Six benefit cards with the gain as the title and the feature in the text. No arrow icons. The Vite plugin card is gone (it is in "Before you start"). Code chips wrap instead of truncating.
5. "Before you start": MIT, 0.x pre-release, Node 22 and Vite 7, TypeScript and TSX. No browser item, since the docs name none (see the docs follow-up below).
6. Final call to action with the guide button and the install command.
7. The sample is the 22-line counter, static, inside one `.landing-sample` container. `SAMPLE_SOURCE` in `website/src/landing/sample.ts` is the single source, for `docs-live` to swap. A test compiles it. The chunk list beside it shows the todo demo's real chunks.
8. Chart bars grow when the chart scrolls into view (`src/client/chart.ts`, IntersectionObserver, 220 ms per bar, 70 ms stagger). Without JS or with reduced motion they show the end state.
9. Every bar carries its app label ("10 widgets" to "1,000 widgets"). The shade legend is gone.
10. Copy buttons get a 44 px hit target under `@media (pointer: coarse)`.
11. Number mismatch. The 4.7 kB of the chart is the dashboard loader file only (`bootJsGzip`). The loader size depends on the optional features an app turns on. Measured with `idlip/client` bundled with the flags of `vite/features.ts` defined: 9,793 B raw and 3,881 B gzip with none on and `skew` off (the demo loader exactly), 3,941 B with `skew` on, 19,905 B raw and 7,336 B gzip with every flag and `skew` on. `skew` alone adds about 60 B. The chunk list says the loader grows with features and adds no sums. The 7,336 B is the constant `LOADER_MAX_GZIP` in `src/landing/index.ts`. Re-measure it when the loader changes.

Review fixes: the chart bars are held at zero in CSS under the `js` class of `<html>` (set by the head script), so there is no flash and no-JS shows the end state. `src/client/chart.ts` only adds `is-in`. Copy buttons have `min-height: 1.5rem`, and `.install .code-copy` has hover, active and focus-visible styles. The hero and final headlines use `text-wrap: balance`. The hero lead no longer repeats the slogan. New tests cover SITE_URL (absolute `og:image`), escaping of hostile `benchmarks.json` strings, a real html token class in the diagram code, and `chart.ts` with fake globals. 12. Open Graph tags (`og:title`, `og:description`, `og:type`, `og:image`, size and alt) and `twitter:card`. The image is `website/public/og.png`. The image URL is absolute when `SITE_URL` or Vercel's `VERCEL_PROJECT_PRODUCTION_URL` is set, else a path from the site root. 13. The diagram footnote is one sentence. 14. The diagram's server HTML is highlighted (html and js grammars per piece), and the step marks still work. Lit marks keep one color. 15. Docs code blocks have `padding-top: 2.75rem`, so the language label and Copy button no longer cover the first line. No layout shift.

## Not done or open

- Nothing from the 13 items was left.
- The share image is a still. Its chart numbers (4.7 kB, 201.5 kB) do not update when `benchmarks.json` changes. Redo it then. Its headline has no number.
- The `og:image` is relative unless the deploy sets `SITE_URL`. Link scrapers need an absolute URL. The orchestrator should set it for the deploy.
- The copy in the benchmark foot still says "JavaScript loaded before the `load` event", which matches the bench-scale correction. "Qwik 1 was not run" is already right.
- This node made no change to `website/src/markdown.ts` or `website/src/repl/**`. The branch diff shows them only because of the cherry-picked commit `cb6c371`.
- Docs follow-up: the docs name no supported browsers. The landing page leaves the item out. Add a browser support section to the docs, then add the fact to "Before you start".

## Follow-ups

- `docs-live` replaces `.landing-sample`'s content with a live editor.
- A benchmarks docs page would let the chart link there instead of `benchmarks/README.md`.

## Verify

`pnpm --filter idlip build`, `pnpm --filter website build`, `pnpm --filter website test` (65 tests), `pnpm --filter website check:samples` (47 samples, 0 problems) and `pnpm format` pass.
