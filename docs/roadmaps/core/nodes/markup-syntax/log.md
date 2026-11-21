# Log: markup-syntax

- Branch renamed to `feat/markup-syntax` and reset to `batch/core`.
- Checked that no work existed: no `0005-markup.md`, no `test/compiler/markup`.
- The analyzer needs `For`, `Try`, `Head` and `Subscribe` imported in the TSX (`component-unknown` otherwise), so the lowering appends the import as the last line of the output. This keeps source line numbers.
- The analyzer accepts a fragment as a `<For>` row, a `<Try catch>` view and a condition branch, so every block body lowers to a fragment.
- `<tr>` directly inside `<table>` is `html-implied`; the `for` fixture uses `<tbody>`.
- Fixtures are `.txt` so `tsc`, oxlint and oxfmt skip them, as in `test/compiler/view/analyze/fixtures`.
- Wrote `docs/proposals/0005-markup.md` and `nodes/markup-syntax/markup-grammar.md` (proposed frozen contract text).
