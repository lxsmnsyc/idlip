# Outcome: for-key-callback

## Built

- `<For key>` is `(item: T) => string | number`. `key="id"` is the error `for-key`, which gives `key={(item) => item.id}` as the replacement.
- Accepted form: an arrow with one plain parameter and an expression body that reads the item and globals only: field paths, template literals, operators, conditionals and the allowed methods. State, props, the index, calls, objects, arrays and computed path segments are `for-key`.
- IR: `for.key` is `ForKey`, `field` or `computed` (`contracts/view-ir.v10.change-request.md`).
- Field key (`t.id`): the manifest `lists[n].key` is `"id"`, as before. Keyed paths (`todos[id=selected]`), `getChunkFile`, `diffPaths` and chunk names are unchanged. The todo example, manifests and chunk names did not change.
- Computed key (template literal, nested field `t.meta.id`, any other expression): `lists[n].key` is absent and the list chunk exports `key(item)`. `patchList` loads the chunk first and pairs rows with it. The analysis never keeps a keyed segment for such a list, so a `find` becomes `*` plus the field path. `diffPaths` counts every `*` path under it as changed when the list changed (`undefined` in `getListKeys`). Child slots in rows print the same expression in `slot$`.
- Refs in a row of a computed-key list: the tuple key must be a field key, else `ref-key`.
- Contract: `contracts/compiled-format.v15.change-request.md`.
- Types: `JSX.IntrinsicAttributes.key` accepts a callback so `<For key>` type checks and types the item. This weakens the type a little: any function component now accepts a callback as `key` at type level. The compiler rejects it outside `<For>`.
- Converted every `<For key="...">` in examples, benchmarks (apps, README and the dashboard harness), fixtures, tests, website docs and REPL. `docs/proposals/**` keeps its text. The landing has no `<For>`.
- Docs: `views.md`, `reference/idlip.md`, `reference/syntax.md`, `reference/compiler.md` (`ForKey`), `reference/client.md`, `reference/jsx-runtime.md`, `refs.md`.
- Grammar rejects `async` arrows, constant keys (`for-key`, the key must read the item), a name instead of an arrow, destructuring and extra parameters.
- Tests: `test/compiler/view/codegen/key.test.ts` (13: manifest forms, diagnostics, `ref-key` in a computed list, an oracle test that compares the chunk `key` with the same source run by `new Function` on random items for 11 key bodies, the server slot expression), `KEY_FN` detection in `test/vite/features.test.ts` (template key, computed list in a child component, field key off), differential subject `computed-key` (template and nested keys), `api.test.ts` type test.

## Deviations

- Nested field keys are computed, not keyed paths. `todos[meta.id=...]` needs a path syntax, a regex change in the loader and `find` support in the analyzer. Not worth it before `keyed-writes`.
- A computed list loads its row chunk on every change of the list, since the key lives there.
- The server does not write a key into the HTML, so the "server and client agree" property is the chunk `key` against the source arrow and the server `slot$` text, not two evaluations.
- Edited the differential folder: `subjects.ts` (one entry), `subjects/computed-key.tsx`, and the key map type in `harness.ts` and `states.ts`. Also `test/fixtures/reference.ts` (reference diff).

## Note for keyed-writes (add to its brief's "Updates")

`keyed-writes` can rely on a field key only. A `<For>` key is now `ForKey` in the IR: `{ kind: 'field', field }` when the callback is `(t) => t.field`, else `{ kind: 'computed', expr }`. The manifest has `lists[n].key` only for a field key, and `getListKeys` maps a computed list to `undefined`. A write to a computed-key list must use the `*` write set. A nested field key is computed, so `keyed-writes` decides whether to add a dotted field form.

## Gotchas

- Loader: the todo loader is 4026 B gzip (was 4007 B, budget 4096 B) with `HAS_KEY_FN` off. The flag costs +24 B and turns on from a manifest list with no `key`.
- Index pairing of `*` paths misses a moved row whose value equals the old row at the same index. This is why a computed list is "changed" at once.

## Verification

- `pnpm --filter idlip build` ok. `pnpm --filter idlip test`: 65 files, 756 passed, 18 skipped (after the rebase on `batch/core`).
- `pnpm --filter website build`: 28 pages. `test`: 87 passed. `check:samples`: 49 samples, 0 problems.
- e2e (ports 48631 to 48634): 18 passed, including the loader budget.
- Benchmark apps `build`, `build:rows`, `build:dashboard`, `build:scale`: exit 0.
- `pnpm lint`: no errors (warnings only). `oxfmt --check .`: clean.

## Size

- Estimated M, actual M.
