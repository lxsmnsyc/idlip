# Change request: compiled-format, the document root and the loader URL

- From node: entry-setup
- Status: open. Approved by the user on 2026-11-23 (`nodes/entry-setup/proposal.md`, decisions 6 and 9).

## Problem

A root component can now render `<html>`, `<head>` and `<body>`. The state script is written after the markup, so after `</html>`, and the loader takes its root from `script.parentNode`. A binding on `<html>` or in `<head>` is outside that root. The server also has no URL for the loader script.

## Proposed change

- `Manifest.document?: true`: present when the component's view is a document (`<html>` root). `RenderResult.document` and the functions that write a document read it.
- `Manifest.documentRoot?: true`: present when `<html>` or `<body>` has a bound attribute. Only then is the state script `<script i-state="document" ...>`, and the loader flag `HAS_DOCUMENT` is on. A document with static `<html>` and `<body>` attributes keeps `<script i-state ...>` and the root `script.parentNode`, so the todo loader does not grow (4087 of 4096 B gzip before the change).
- The server writes the state script of a document before `</body>`, so the parser keeps it in `<body>`.
- The loader takes `document.documentElement` as the root of a state script whose `i-state` value is `document`, and the patch index counts the bindings of the root element itself (`<html i-a>`). Any other state script keeps `script.parentNode`.
- A document `<head>` with no hole stays plain markup in `<head>`. One with a hole is the first `<Head>` block of the body, so `manifest.head` is set and `HAS_HEAD` turns on.
- The chunk map of a server module gets a `loader` key next to `build` and `helpers`: the URL of the loader module. The plugin writes it in a build (the built file) and in dev (`<base>@id/idlip/client`). The server drops it from the state script, as it drops `build`, and returns it as `RenderResult.loader`.
- `RenderResult` gets `document: boolean` and `loader: string | undefined`.

## Affected nodes

`resume-loader` (the root), `ssr-render` (the state script), `vite-plugin` (the `loader` key).

## Workaround in place

Implemented in `src/server/render.ts`, `src/client/loader/resume.ts`, `src/vite/plugin.ts`, `src/core/format.ts` and the compiler's manifest.

## Decision

Pending.
