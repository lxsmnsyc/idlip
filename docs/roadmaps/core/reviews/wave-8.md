# Wave 8: the apps milestone, one-shot run (2026-11-21)

Landed on `batch/core` since `wave-7.md`: `nesting-format`, `write-sets`, `nesting-compile`, `spike-chunk-merge`, `global-events`, `dom-refs`, `fix-rows-collision`, `nesting-runtime`, `commands-subs`, `fix-flaky-tests`, `nesting`, `loader-trim`.

Landed on `feat/markup-frontend` (story, local): `markup-parser`, `markup-lower`, `markup-compile`, `markup-language-core`, `markup-vscode`, `markup-example`. Every child is done. The story pull request waits for PR #1 (the first batch cut) to merge, then `main` is merged into the story branch.

Numbers: todo loader 3881 B gzip (budget 4096 B, contract); cold first click at 150 ms RTT 209 ms with one round trip (was 354 ms, two). Counters loader 4918 B with children on.

Decisions made in the one-shot run (user can revisit): runtime feature flags keep the loader budget; 4096 B is the loader with no optional features; no chunk merge threshold; `$step: true` discriminant on steps; slot lifecycle `live | removed` with a generation; the docs site is a static Vite and markdown-it build; `dynamic-paths` uses whole-model helper calls and model aliases; `prefetch` ships off by default unless it beats the noise.

Open change requests not yet applied to contracts (they describe landed code): `compiled-format-write-sets`, `compiled-format-nesting`, `compiled-format-refs`, `compiled-format-subscribe`, `core-api-dom`, `view-ir-refs`. The next curator pass applies them.

Active at the time of writing: `errors`, `prefetch`, `hmr`, `form-fields` (review fixes). Ready next: `errors-client`, `dynamic-paths`, `document-head`, `svg-and-html`, then `deploy-skew`, the website nodes, `markup-ts-plugin` (after the story merges), `keyed-writes` and `update-ops` (0.2, held by the release fence).

Parked in `inbox.md`: harness todo-count regex, `loadBindings` running every export, oxlint and `.idlip` files.
