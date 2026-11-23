# Change request: core-api, stylesheets of the page

From: `component-styles`. Target: the `idlip/server` block of `contracts/core-api.md` and the chunk map of `contracts/compiled-format.md`.

## Change

1. `RenderResult` gets one field:

```ts
// idlip/server
interface RenderResult {
  // ...
  styles: readonly string[]; // stylesheet URLs of the root and its children, in import order; frozen
}
```

`renderToStream`, `streamParts` and `renderToResponse` write one `<link rel="stylesheet">` for each URL at the start of the added head output, before the listener and the preload links, with the nonce. A host that writes its own head reads `page.styles`.

2. The chunk map of a server module gets a `styles` key next to `build`, `helpers`, `templates` and `loader`: the stylesheet URLs that the module's import graph reaches, separated by a space. The plugin writes it (a build: the emitted files under the base; dev: the files Vite serves). `render()` drops it from the state script and returns the union over the root and its children as `RenderResult.styles`. The client chunk map `.idlip/chunks.json` has one `styles:<module file>` key for each file, which the plugin copies into the server module.

3. `csp: true` adds `style-src 'self' 'nonce-<nonce>'` to the policy. A `style-src` in `csp.extend` replaces it (it does not add to it). No other directive changes.

## Why

A stylesheet imported by a component never reached the page: the compiler dropped the side-effect import and nothing linked the file. The server has no other way to learn the URLs, since it reads no manifest and no file.

## Affects

`render-stream` (the stream writes the links), `entry-setup` (hosts that build their own head), `vite-plugin` (the key).
