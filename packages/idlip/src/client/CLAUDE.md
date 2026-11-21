# client

- The loader (`loader/` with its static imports) has a 4096 B gzip budget with no optional features. A loader that only some apps use goes behind a `HAS_*` flag from `features.ts`. Why: every page pays for the loader before the first click.
- A new flag takes three edits: `declare const __IDLIP_HAS_NAME__` and `export const HAS_NAME` in `features.ts`, one line in `DETECTORS` in `../vite/features.ts`, and `if (HAS_NAME)` around the code. Why: the bundler can fold the branch only when the test is that exact form.
- A flag name must not appear in other code or in a string. Why: the plugin replaces the text.
- A chunk may import from `idlip/client` only what the loader already holds. Why: a chunk import that is not in the loader costs a third request on the first click.
- Tasks run through `runTask(host, task)` in `tasks/run.ts`. Do not add another path for an awaited call. Why: `apply` and the settle order depend on one.
