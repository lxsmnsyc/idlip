# Change request: compiled-format v10, build id

- From node: deploy-skew
- Status: open

## Problem

A page cached from an older deploy names chunk files that a newer deploy removed. The format has no build id, so the client cannot tell a removed chunk from a broken one, and cannot ask which build the server runs.

## Proposed change

- **Build id.** The state script carries `i-build="<id>"`, where `<id>` is 8 hex digits: a hash of the file names of the client build, which hold the content hashes. Absent in dev and when the plugin option `skew` is `false`. Every state script of a page carries the same id, and the loader reads the first.
- **Chunk map.** The chunk URL map (`.idlip/chunks.json`, `export const chunks` of the server module) has one extra key, `build`, with the id as its value. Chunk ids start with `/`, so no chunk collides. `render()` moves it from `chunks` to the `i-build` attribute: it does not reach the state script's value.
- **Build file.** The client build writes `build.js` next to the loader entry. It exports the build id as its default export and a `check()` function. A script is used, not a `fetch`, because a strict CSP (`default-src 'none'`, as in `examples/todo`) blocks a `fetch` of the page and allows a dynamic `import()` from a nonced module. The loader holds one call: when a chunk fails for good (after the retry, when `HAS_RETRY` is on), it imports `build.js` from its own folder and calls `check()`. Serve `build.js` with `Cache-Control: no-store` or a short max age.
- **Check.** `check()` reads `i-build` of the page. When it differs from the build id of `build.js`, and `sessionStorage['idlip:builds']` (a JSON object of build id to `'reloaded'`) does not list it, `check()` records it and reloads. State per tab and build is `'fresh' | 'reloaded'`, with `fresh` as an absent key, so a cache that serves the old page again does not loop. The old build's own chunk files are not needed, and `build.js` of the current build always loads.
- **Retention.** The client build keeps the files of the previous build and deletes the files of older ones (`build.emptyOutDir` is `false` for the client environment, and `writeBundle` deletes only files that the record `<outDir>/.idlip/builds.json` lists for older builds, never files of `publicDir`). Retention needs `build.outDir` kept between deploys, or the previous build restored; on a clean checkout it keeps nothing. A page two builds old finds its chunks gone, and the reload recovers it.
- **Flags.** `HAS_SKEW` is set by the plugin option `skew` (default on), not by a manifest detector. `skew` does not need `HAS_RETRY`: the check runs at the final failure of `load`, whether or not a retry ran first.

## Affected nodes

`errors-client` (the failure point in `load`), `vite-plugin` (chunk map key, `emptyOutDir`), `ssr-render` (the attribute).

## Workaround in place

Implemented in `src/client/skew.ts`, `src/vite/skew.ts`, `src/vite/plugin.ts` (`generateBundle`, `writeBundle`), `src/vite/features.ts` (`getDefines`) and `src/server/render.ts` (`mergeState`, `writeState`). The hook is `checkSkew()` in `load` of `resume.ts` under `HAS_SKEW`.

## Decision

Filled in by the orchestrator.
