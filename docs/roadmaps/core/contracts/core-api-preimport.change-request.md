# Change request: core-api and compiled-format, preimport

From: `preimport-chunks`. Targets: the `idlip/server` and `idlip/vite` blocks of `contracts/core-api.md`, and the feature flags paragraph of `contracts/compiled-format.md`.

## Change

1. `renderPage` returns two more fields, the arguments of `renderPreload`:

```ts
// idlip/server
interface RenderResult {
  head: string;
  body: string;
  chunks: ChunkUrls; // the state's chunk URLs, children included, without `build`
  manifests: readonly Manifest[]; // the root's manifest, then the child manifests
}
```

`renderPreload(page.chunks, page.manifests)` names the first click's chunks of the rendered page. The values are the same object for every render of a module (the cached static part).

2. `IdlipOptions.preimport?: boolean` (default off) sets a new flag `HAS_PREIMPORT`. Like `HAS_SKEW`, it follows a plugin option, not a detector. When on, after `load` at `requestIdleCallback` (or `setTimeout`), the loader calls its `load(url)` for the `href` of every `<link rel="modulepreload">` of the document. The first click then awaits settled promises. Cost +86 B gzip on the todo loader; 0 B when off (the file is byte-identical).

## Why

`prefetch` left `renderPreload` unwired: an app could not reach `manifest` and `chunks` of its compiled module with types. A preload only fetches; the click's `import()` still resolves in a task of its own and runs the module (brumate `af923d74`). See `nodes/preimport-chunks/outcome.md` for the numbers.
