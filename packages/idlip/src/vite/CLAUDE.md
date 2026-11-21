# vite

- `features.ts` replaces `__IDLIP_HAS_*__` as text, one literal per line, with `map: null`. Keep line counts the same. Why: there is no source map for the replacement.
- A component outside the plugin's `modules` globs that needs a flag that is off fails the build. Do not fall back to on silently. Why: the loader would lack code the page needs.
- Chunk kinds are `handler`, `binding`, `list`, `task`, `source`, `try` and `view`. A new kind needs `parseChunkId`, `listChunks` and `getChunkFile` (`../core/format.ts`) together. Why: a kind that one of them misses fails only in the build.
- A flag is on from a detector in `DETECTORS` (`features.ts`) that reads the compile result, such as `manifest.fallback`. `HAS_SKEW` is the exception: the plugin option `skew` (default on) sets it through `getDefines(on, skew)`. Why: skew has no manifest sign. A detector must read everything that needs the loader code (`HAS_KEYED` reads group paths only: see `keyed-writes`).
- Skew retention keeps the files of the previous build and deletes older ones through `<outDir>/.idlip/builds.json`, with `emptyOutDir: false` for the client environment. It never touches `publicDir` files. Why: a page cached from the last deploy still needs its chunks, and a page two builds old recovers by reload.
- `build.js` is served with `Cache-Control: no-store` or a short max age, and the `skew` option documents it. Why: a cached copy hides a new deploy. It is not a chunk: `listChunks` and the chunk map skip it, and the chunk map has the extra key `build`, which `render()` moves to `i-build`.
- `hot.ts` sends `idlip:hot` for the client environment only and `full-reload` for a module that does not compile. Why: the ssr environment keeps Vite's default handling.
