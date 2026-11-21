# vite

- `features.ts` replaces `__IDLIP_HAS_*__` as text, one literal per line, with `map: null`. Keep line counts the same. Why: there is no source map for the replacement.
- A component outside the plugin's `modules` globs that needs a flag that is off fails the build. Do not fall back to on silently. Why: the loader would lack code the page needs.
- Chunk kinds are `handler`, `binding`, `list` and `task`. A new kind needs `parseChunkId`, `listChunks` and `getChunkFile` (`../core/format.ts`) together. Why: a kind that one of them misses fails only in the build.
