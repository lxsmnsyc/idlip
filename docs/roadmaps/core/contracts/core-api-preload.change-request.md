# Change request: core-api, preload

From: `prefetch`. Target: the `idlip/server` block of `contracts/core-api.md`.

Status: open.

## Change

1. `Manifest.listens` (compiled-format): event type to the sorted names of the handlers the view dispatches on it, such as `{ click: ['toggle'] }`. Absent when no element dispatches a handler. A message prop (`target.kind === 'prop'`) adds no name: its handler belongs to the parent. `events` is unchanged. The compiler fills it in `view/codegen/plan.ts`. The todo, counter, effects and nested goldens gain one `listens` entry each (manifest.json, the `manifest` line of server.js and the state script of page.html). Nothing else in them changes.
2. `idlip/server` exports `renderPreload` and `PreloadOptions`.

```ts
// idlip/server
interface PreloadOptions {
  events?: readonly string[]; // most likely first, default ['click']
  max?: number; // default 8
  format?: 'link' | 'header'; // default 'link'
  nonce?: string; // on each <link>
  crossorigin?: 'anonymous' | 'use-credentials';
}
function renderPreload(
  chunks: ChunkUrls,
  manifest: Manifest | readonly Manifest[], // the root, and the values of PageState.modules
  options?: PreloadOptions,
): string;
```

- It reads `listens` of each manifest. For each event in order, each manifest in order and each handler name in sorted order, it names the handler chunk, then the binding chunks of the handler's `bindings`, until `max`. Nothing else is named.
- It needs no markup, so a `Link` header can go out as a 103 Early Hint before the page renders.
- `link` returns `<link rel="modulepreload">` tags for `<head>`. `header` returns a `Link` header value.
- The loader imports the same URLs, so the browser reuses each preload and the first click makes no request.

## Why

The first click on a cold page waits one round trip for the handler chunk. A preload removes it. See `nodes/prefetch/outcome.md` for the numbers.
