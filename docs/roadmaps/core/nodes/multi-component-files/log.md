# Log

- Read the brief, the plain-tsx outcome, the compiled-format contract, the compiler, vite and client CLAUDE.md files, and the two docs pages.
- Picked the module id `<file>#<Name>` for every component but the main one. `getChunkId` moves the name after `?idlip-`, so the chunk id keeps the real file before `?`. A path-like id (`widgets.tsx/Counter`) was rejected: Vite's module graph would not tie the chunk to the file, so hot edits would miss it.
- `selectComponents` (`compiler/view/codegen/components.ts`) picks the default export, named exports and the private components they render. `generate` plans all of them, then emits one server module.
- First walk of the view IR stopped at the first `undefined` field and missed `Counter`. Fixed by looping on the stack's length.
- Golden fixtures stayed byte for byte. The one-component server module is assembled in the same order as before.
- `replaceChunkUrls` now fills every chunk map from the given URL map by its own keys. The old test passed a partial map and expected it whole. Updated the test.
- `idlip/testing`: `mount` served only the first component's chunks and checked against a render with no child models. It now serves every component and passes child slot models to the check render.
- Loader: `getChunkId` with a `lastIndexOf` branch cost 32 B with gzip. A `replace` costs 21 B. Todo loader 3979 B to 4000 B, budget 4096 B.
- The brief named `contracts/compiled-format.change-request.md`, which holds the applied v7 to v8 request. Wrote `compiled-format.v14.change-request.md` instead, as the v12 and v13 requests are named.
- e2e ran with ports 48621 to 48625. 18 passed.
