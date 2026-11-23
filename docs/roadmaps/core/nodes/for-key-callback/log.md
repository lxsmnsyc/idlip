# Log

- Key forms: a body that is a path of one item field is a `field` key. Everything else in the closed grammar that reads the item and globals only is `computed`. A nested field is computed, because `find` keyed segments and the KEYED path regex hold one field only.
- Computed keys live in the list chunk as `export function key(item)`. The loader loads the chunk before it pairs rows. No row key is written into the HTML, so the server needs the expression only for child slots (`slot$`).
- First differential run with a template key failed (class `done` on moved rows). Pairing `*` paths by index misses a moved row whose field value matches the old row at the same index. A computed list now counts as changed when the list changed (`undefined` in `getListKeys`).
- `<For key>` collides with `JSX.IntrinsicAttributes.key`. Widened it to `string | number | ((item: never) => string | number)`, which keeps `t` typed in `key={(t) => t.id}`.
- Converted every `key="..."` on `<For>` by script (examples, benchmarks, fixtures, tests, docs, REPL). `docs/proposals/**` left as the record of its day.
- Regenerated `counter.json` and `todo.json` with a throwaway test, then ran oxfmt.
- e2e ports 48631 to 48634. The example builds had to run first.
- Edits in `test/differential/**` (shared with another worker): `subjects.ts` entry and `subjects/computed-key.tsx`, and the key map type (`string | undefined`) in `harness.ts` and `states.ts`.
- Review fixes: rebased on `batch/core`, KEY_FN detection tests, oracle key test, stricter key grammar (async, constant, plain parameter), for-of in `readKeyReads`, `readKey` as a declaration, docs on the cost of a computed key.
