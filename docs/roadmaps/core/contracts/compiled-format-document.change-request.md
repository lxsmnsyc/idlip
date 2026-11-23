# Change request: compiled-format, the document root and the loader URL

- From node: entry-setup
- Status: open. Approved by the user on 2026-11-23 (`nodes/entry-setup/proposal.md`, decisions 6 and 9).

## Problem

A root component can now render `<html>`, `<head>` and `<body>`. The state script is written after the markup, so after `</html>`, and the loader takes its root from `script.parentNode`. A binding on `<html>` or in `<head>` is outside that root. The server also has no URL for the loader script.

## Proposed change

- `Manifest.document?: true`: present when the component's view is a document (`<html>` root). `RenderResult.document` and the functions that write a document read it.
- The state script of a document component is `<script i-state="document" ...>`. A page that is not a document keeps `<script i-state ...>`. The server writes it before `</body>`, so the parser keeps it in `<body>`.
- The loader takes `document.documentElement` as the root of a state script whose `i-state` value is `document`. Any other state script keeps `script.parentNode`.
- The chunk map of a server module gets a `loader` key next to `build` and `helpers`: the URL of the loader module. The plugin writes it in a build (the built file) and in dev (`<base>@id/idlip/client`). The server drops it from the state script, as it drops `build`, and returns it as `RenderResult.loader`.
- `RenderResult` gets `document: boolean` and `loader: string | undefined`.

## Affected nodes

`resume-loader` (the root), `ssr-render` (the state script), `vite-plugin` (the `loader` key).

## Workaround in place

Implemented in `src/server/render.ts`, `src/client/loader/resume.ts`, `src/vite/plugin.ts`, `src/core/format.ts` and the compiler's manifest.

## Decision

Pending.
