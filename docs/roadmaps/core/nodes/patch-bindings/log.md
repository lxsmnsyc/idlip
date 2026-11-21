# Log: patch-bindings

- Read the contract (v8) and the compiled-format outcome. Started from the reference `diffPaths`.
- `patch()` is built by `createPatch(patchList)` so `patch-lists` plugs in without an import cycle.
- Mutation check: turning off the key pass in `diffPaths` makes the property test fail.
- Size of `src/client/patch/index.ts` bundled and minified: 5.64 kB, 2.30 kB gzip.
