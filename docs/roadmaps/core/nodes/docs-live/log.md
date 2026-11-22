# Log: docs-live

## 2026-11-22

- Branch `node/docs-live` from `batch/core` at `12204d7`.
- Survey: rendered each of the 47 docs samples in Node through `compileProject` and `renderProject`. 37 rendered with `{}` props. 7 threw because they read a list prop (`items is not iterable` and similar). `nesting-1`, `nesting-2` and `reference-syntax-5` need a sibling file or a callback prop.
- `run.ts` kept one run folder per page and revoked the previous run's blobs. Two samples on one page would delete each other's chunks. Split it into `createRunner()`, one owner id per runner. `runFiles` is the REPL's runner.
- The render worker revoked the previous request's module URLs at the start of each request. With two samples rendering at once, the second render revoked the first one's modules (`Failed to fetch dynamically imported module: blob:...`). Each request now revokes its own URLs when its render ends.
- A render timeout terminated the worker and failed every waiting request. Now only the slow request fails, and the others go to a new worker.
- `data-live` is already the hero stage's attribute (`client/hero.ts`). The first build started a sample on the hero figure. Renamed to `data-live-sample`.
- `new URL('../live/frame.css', import.meta.url)` made Vite bundle the source file as an asset, so the frame got the 339-byte live rules only and no tokens. The URL is now built from `import.meta.url` with a string replace.
- `.live-frame { display: block }` beat the `hidden` attribute. Added `[hidden]` rules.
- `components.md` and `nesting.md` belong to another worker. `components.md` got only fence info edits: 2 of its 4 samples are live. The other 2 (`Counter` with `start`, `Cart` with `price`) need a props file, so they stay static. `nesting.md` is unchanged.
- oxfmt puts a blank line between adjacent fences. Blank lines make no Markdown tokens, so the files still group.
