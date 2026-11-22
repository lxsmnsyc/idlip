# Log: shared-templates

- Read brumate `runtime/client/templates.ts`: `encodeWalk` sorts the marked nodes in document order and emits moves (first child, parent, n next siblings, mark index).
- Step 1 design: per-hash virtual modules cannot be preloaded within the 4096 B loader budget (the loader would need each chunk's template files). One virtual module `idlip/templates` holds every template that more than one chunk renders, keyed by hash (export `t<hash>`), and loads with the helpers module under the chunk map key `templates`.
- The bundler cannot decide sharing, since a chunk must know at compile time whether to import or declare. The plugin compiles every module once, counts chunks per hash from `Module.templates`, and compiles again with `shared`. Two declarations under one hash stay in their chunks.
- Dev compiles without `shared`, so each chunk declares its templates and HMR is unchanged.
- The bundler may merge the templates module into the helpers file when the same chunks import both. Then the `templates` key is omitted.
- Step 2: `Template.k` holds the parse of the first document, `m` is a WeakMap for any other.
- Step 3: built the encoded walk inline in `clone$` (helpers hold no comments or outside names, so no shared constants). Tests and differential green. A/B on rows (N=15, load 2.94 at start): create1k, replace1k, append1k, create10k all within noise. Helpers module grew 281 B raw (+137 B gzip). Same speed and larger, so it was dropped. The walk test stays.
- First click dashboard A/B (N=21, 150 ms): within noise.
- A dist folder copied after several builds holds the files of earlier builds (skew keeps them). Sizes were measured on clean builds.
