# Change request: core-api, renderPage for renderPreload

From: `preimport-chunks`. Target: the `idlip/server` block of `contracts/core-api.md`.

## Change

1. `renderPage` returns two more fields, the arguments of `renderPreload`:

```ts
// idlip/server
interface RenderResult {
  head: string;
  body: string;
  chunks: ChunkUrls; // the state's chunk URLs, children included, without `build`; frozen
  manifests: readonly Manifest[]; // the root's manifest, then the child manifests; frozen array
}
```

`renderPreload(page.chunks, page.manifests)` names the first click's chunks of the rendered page. Both are read-only: every render of a module returns the same frozen objects (copies made once per cached static part, since seroval writes a frozen object with `Object.freeze`).

2. `idlip/server` exports the types `ChunkUrls` and `Manifest`, which `RenderResult` and `renderPreload` name. `reference/server.md` documents them.

No loader or plugin change: an idle import of the preloaded modules (`preimport`) was built, measured and removed (see `nodes/preimport-chunks/outcome.md`).

## Why

`prefetch` left `renderPreload` unwired: an app could not reach `manifest` and `chunks` of its compiled module with types.
