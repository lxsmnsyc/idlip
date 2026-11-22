# Log: cloned-templates-all

Sizes are gzip -9. "Loader" is the todo example's `loader.*.js` (the e2e `loaderBudget` file), "helpers" the todo app's `_idlip-helpers.*.js`. Builds start from empty `dist` folders (a kept `dist` holds the previous build's files too).

## Baseline (`batch/core` 1450e63)

- todo: loader 4063 B, helpers 927 B, dist 13 files 6962 B
- counters: loader 5006 B, helpers 454 B
- rows: helpers 926 B, dist 17 files 7648 B
- dashboard: loader 4858 B, helpers 740 B, dist 365 files 103954 B
- Base builds of rows, dashboard and the todo bench copied to the scratchpad for the A/B at the end.

## Fix before step 1

The `nested-blocks` subject failed on the base, with the HTML path: a click that shows a branch and changes the list inside it ran `patchList` with the old items against rows the branch had just rendered from the new model (`TypeError` in `getTopNodes`). Fixed in its own commit: `addBlock` records the blocks a patch adds, `patchList` skips a list among them. 22 B on the todo loader, so behind a new flag `HAS_INNER_LISTS` (a list marker `<!--l` in a chunk's markup). Test `test/client/patch/fresh-list.test.ts` fails without the skip.

## Step 1: blocks inside cloned bodies

- A bound condition in a body is `<!--c<id>:x<n>--><!--/c-->`. `clone$` keeps a comment whose data ends in `x<n>` as a comment with the data before the mark, so the write appends the branch number (`$n[1].data += 0`) and puts the branch after it. An unbound condition is a placeholder text node that the branch replaces (`replaceWith`) or that is removed for an empty branch.
- A list is `<!--l<id>--><!--/lx<n>-->`: a loop clones each row (`templateL<id>$`, with row markers) and puts it before the end comment.
- Templates move into `usage.templates` and print once per chunk: a binding chunk with a condition and the binding of a condition inside it would otherwise declare one template twice. Names: `templateL<id>$` (rows, also the list chunk's own row, which was `template$`), `templateC<id>_<branch>$`.
- Nested fragment variables are `$n`, `$n2`, ... per render function.
- `clone$` parses into a fragment of the document (`append(...parseHtml$(...))`), which also takes an empty template and, later, a namespace.
- The list chunk exports `blocks = true` when a cloned row holds a block, and `patchList` then walks the row for blocks to run the hooks. Rows without blocks skip the walk as before.
- Differential subjects `nested-blocks` (marked) and `nested-blocks-unmarked` (empty branch of an unbound condition). Mutation: appending `0` for every branch fails 2 tests.
- Sizes: todo loader 4073 B (+10, the `blocks` check), helpers 969 B (+42). Counters loader 5016 B, dashboard loader 4890 B (+32 with `HAS_INNER_LISTS` on), dashboard dist 104462 B, rows dist 7711 B.
