# Outcome: write-sets

## Built

- `packages/idlip/src/compiler/update/writes.ts`: `listWrites(file, source, component)` returns the write set of each handler by name, and `meetsPath`. A write to a state `let` is its field, a destructuring or loop target too. `x = x.map((t) => (<test> ? { ...t, f: <e> } : t))` is `x.*.f` for each field after the spread. The set is the union over the handler and the handlers it calls. A state write the analysis cannot read (`todos.push(...)`, `todos[0].done = true`, `cfg.n++`, `delete`, a mutator method) gives no set (undefined) for that handler and its callers.
- `src/compiler/view/codegen/index.ts`: each `manifest.handlers` entry (continuation tags too) gets `writes` and `bindings` (groups that meet a write, minus the groups another listed group covers), or neither when the set is undefined.
- `src/client/loader/resume.ts`: on an event the binding chunks of `bindings` start with the handler chunk through the shared `load`, so `page.load` reuses the promise. No flag: the code is 22 B and every app with handlers uses it.
- Not built, on review: narrowing `patch` by `writes`. `Patch` and `diffPaths` are unchanged.
- Fixtures: `manifest.json`, `server.js` and `page.html` of counter, todo and effects carry the new entries. The todo `toggle` entry is `{ writes: ["todos.*.done"], bindings: ["todos.*.done"] }`.
- Tests: `test/compiler/update/writes.test.ts` (write sets, destructuring, unreadable writes, `meetsPath`), `test/client/loader/writes.test.ts` (the binding import starts before the gated handler resolves, only the write set loads, a failed preload does not break the patch, an entry without bindings).
- Change request: `contracts/compiled-format-write-sets.change-request.md`.

## Proof

- base: first click right after `load` at 150 ms RTT, idlip: 354 ms, 2 round trips (`benchmarks/README.md`).
- branch: `pnpm -C benchmarks/harness bench --scenario todos --only idlip --rounds 1`: cold 209 ms, 1 RT, 2 requests (run before the review changes, which did not touch the preload). The machine was busy (load 4.7 on 8 cores). The e2e request test still sees only `toggle` and `binding=todos.*.done` on the first toggle.
- Loader gzip -9 (Node `gzipSync`, the e2e method), todo build: 3891 B on `batch/core`, 3913 B on the branch (+22 B). The budget is 4096 B.

## Deviations

- Tests outside the owned paths changed because the manifest and load order changed: `test/testing/mount.test.ts` and `test/client/loader/loader.test.ts` compare the loaded chunks as a sorted set. `effects.test.ts` and `codegen.test.ts` assert the full entry.
- No `HAS_WRITES` flag and no patch narrowing (review decision): the flag would be on for any app with a handler, and `diffPaths` is cheap.

## Stubs left

- None.

## Gotchas

- A failed binding preload is swallowed in the loader. The patch asks again through `page.load`.
- In the loader tests the counter binding chunk cannot import `idlip/client`, so its preload fails silently there. The todo chunks load.
- `bindings` can list several sibling groups (`add` lists `todos.*.done`, `todos.*.id`, `todos.*.text`, `draft`), since `todos` replaces the list. A chunk loaded and unused costs bytes only.
- A pattern target that is shadowed by a local counts as a write of the field. That only over-approximates.
- Keyed write paths (`todos[id=$p].done`) are not produced yet. `meetsPath` already treats a keyed segment as `name.*`.

## Proposed learnings

- Compare loaded chunks as a sorted set in tests | parallel loading fixes no arrival order | packages/idlip/test | no

## Verification

- `pnpm --filter idlip test`: 497 passed.
- `pnpm build && pnpm --filter e2e test`: 10 passed.
- `pnpm typecheck`, `pnpm format:check`, `oxlint --type-aware`: clean.

## Size

- Estimated M, actual M.
