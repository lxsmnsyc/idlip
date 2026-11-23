# Change request: core-api, the entry and `renderToResponse`

- From node: entry-setup
- Status: open. Approved by the user on 2026-11-23 (`nodes/entry-setup/proposal.md`).

## Change

1. `render(component, props, options?)` of `idlip/server` returns `Promise<RenderResult>`, the result `renderPage` had. `renderPage` is removed. `RenderResult` gains `document: boolean` and `loader: string | undefined`.
2. `renderToResponse(component, props, options?): Promise<Response>` renders, then streams the document as a `Response`. Options: `StreamOptions` plus `csp?: boolean | { extend?: Record<string, readonly string[]> }`, `status?` and `headers?`. `csp` makes a nonce (or uses `nonce`), writes it on every script and link the server adds, and sets `content-security-policy` to `default-src 'none'; script-src 'nonce-N' 'strict-dynamic'; base-uri 'none'; object-src 'none'; require-trusted-types-for 'script'; trusted-types idlip`. `extend` adds sources to a directive. `script-src` and `trusted-types` cannot be extended. In development it sets no header.
3. `renderToStream`, `streamParts` and `renderToResponse` need a document component (`RenderResult.document`). Otherwise they throw a `TypeError`. `render` takes any component.
4. `StreamOptions.loader` stays as the override of the built-in loader URL. The streams splice the head output, the listener, the preload links and the loader script into the component's `<head>`, and write nothing around the document.
5. An entry is `export default { fetch(request: Request): Response | Promise<Response> }`. `IdlipOptions.entry` names it. In `vite dev` without Nitro the plugin calls it; with a plugin named `nitro:main` it does not. `IdlipOptions.server?: false` turns the middleware off.

## Why

Each entry built the document by hand. See `nodes/entry-setup/proposal.md`.

## Decision

Pending.
