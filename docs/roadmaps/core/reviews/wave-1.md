# Wave 1

Landed on `batch/core` (local, not cut):

- `core-api` (b4cf59d): package layout, block component stubs, JSX event types. Contract `core-api` frozen at v7, with `For` children taking `(item, index)`.
- `spike-chunk-split` (6a8b0ec): chunk ids are `<file>?idlip-handler=<name>&lang.tsx` and `?idlip-binding=<path>&lang.tsx`. Rolldown merges none of them. A helper shared by two chunks becomes a third request, so the compiler copies module-level helpers into each chunk. The plugin needs `enforce: 'pre'`.
- `spike-view-analysis` (e0183b3): all 103 holes in 6 fixtures resolve to static paths, none `dynamic`, under 0.72 ms per file. Contract `view-ir` frozen at v7 through an accepted change request.

Orchestrator decisions, delegated by the user:

- Pure globals (`String`, `Number`, `Boolean`, `Math.*` except `random`) and a fixed list of non-mutating methods are allowed in holes.
- The analysis follows imported components; an import that is not an `.idlip.tsx` component is `component-import`.
- Root lint ignores `docs/**`.

Plan changes:

- `compile-view-analyze` resized from M to L.
- `compiled-format`: `<li>` outside a list is not a parser rewrite.
- `dynamic-paths` may be unneeded unless the hole grammar widens.

Gate: the contract wave (`core-api`, `view-ir`) waits for the user. The cut of `batch/core` into `main` goes to the maintainer: it carries gated contract nodes. The full check passes on the batch.

Next: wave 2 (`compiled-format`, `compile-view-analyze`, `jsx-types`) after the gate.
