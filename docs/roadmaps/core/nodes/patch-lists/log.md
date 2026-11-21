# Log: patch-lists

- Rebased onto batch/core 5e17ce3 after the v9 note: a chosen row binding runs on every kept row. Dropped the outside-state skip I had drafted.
- `patchList` is in `src/client/list/index.ts`. `seam.ts` stands in for patch-bindings' `onBlock` registry and template parser.
- Moves use a longest increasing run, so a reorder moves few rows.
- Wrote `contracts/compiled-format-patch-lists.change-request.md`: no `l` is chosen when only outside state changes.
- 19 tests in `test/client/list/list.test.ts`, 179 in the package. Size 1651 B gzip with the seam.
- Review fixes: depth-3 nesting (pass bindings through), skip a detached nested `l`, oracle from the fixture server module, SVG and duplicate-key tests, shared helpers. 22 tests, 1640 B gzip. Seam not yet replaced.
- Seam replaced by `src/client/patch` imports and deleted. 272 tests in the package. patchList adds 1446 B gzip over the patch module.
