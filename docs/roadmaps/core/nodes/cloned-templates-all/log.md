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

## Step 2: children inside cloned bodies, and a child's view

- A child in a body is `<!--n:x<n>--><!--/n-->`. The write computes the slot path once (`const $np1 = slot$(...)`), appends it to the start comment and puts `addChild(path, module, view, props, $doc)` after it.
- `addChild` with a document returns the child's nodes. Without one it returns the old HTML with the boundary comments, for bodies that still render HTML; a cloned view is serialized through a `<template>` there. Both forms are for the steps in between: once every body clones, only the node form stays.
- The `view` chunk clones when its view writes a value: `render(scope, $doc)` returns the fragment of `templateV$`. A static view renders HTML until step 8.
- Goldens: `UPDATE_NESTED=1` in `nesting.test.ts` writes the nested chunks again. `nested/counter/expected/client/view.js` and `nested/board/expected/client/list.2.js` are the compiled output now. The fixture row test prints both sides as nodes (`printRow`) in a happy-dom window, and the reference `addChild` takes the document.
- Differential subject `cloned-children` (child `tally.tsx` with a condition and a list in its view): children next to holes in a row, in a row's condition, in a list in a branch. Mutation: dropping the slot path from the start comment fails 2 tests.
- Sizes: todo loader 4073 B, helpers 969 B (no change). Counters loader 5113 B (+97, the two forms of `addChild`), counters helpers 845 B (the counters app now uses `clone$`). Dashboard dist 107015 B (+2.5 kB: the child views are templates plus writes, longer than the HTML strings).

## Step 3: SVG and MathML bodies

- A body in SVG or MathML clones: its template declares `s: 'svg'` or `s: 'mathml'`, and `clone$` parses it through `parseHtml$` with that namespace (inside an `<svg>` or `<math>` wrapper), then moves the nodes into a fragment of the document.
- A `title`, `style` or `script` in SVG or MathML is an element like any other (the parser is in foreign content there), so its holes clone with comment marks. The server writes the same text, escaped, and the parser decodes it in foreign content.
- `canClone` loses its `namespace` parameter.
- Differential subject `foreign`: SVG rows with bound attributes, text and a `foreignObject` with HTML holes, an SVG `title` with a hole, an SVG branch with a nested list, MathML rows with a condition. The differential comparison does not read namespaces, so `template.test.ts` checks the namespace of a cloned SVG element. happy-dom keeps MathML in the HTML namespace, so the test compares with happy-dom's own parse; the real-browser check is at step 5.
- Sizes: no loader or helpers code change (todo loader 4073 B, helpers 969 B).

## Step 4: text holes in text elements and in a `pre`

- The analyzer already rejects a hole in `script` and `style`, more than one hole in a `textarea`, and a `title` outside `<Head>`, so the reachable cases are a `textarea` with one unbound hole, a `pre` (or `listing`) with any holes, and a `<Head>` title (step 6).
- A hole in an HTML `textarea` or `title` marks the element, and the write appends the text: `$n[5].textContent += getText$(value)`.
- The newline rule: the parser drops a newline right after `<pre>`, `<listing>` and `<textarea>`. The server already wrote one for a textarea; it now writes one for a `pre` and a `listing` with children too (`html.ts`), and so does the template. The text after it then stays as written, whatever comes first (a hole, a marker or static text), so the clone needs no newline logic. happy-dom does not drop the newline, which is why the textarea write appends (`+=`): the template's newline stays in happy-dom as the server's does, and the browser drops both.
- A first attempt dropped the newline in the write (`replace(/^\n/, '')`) and failed the differential test in happy-dom; writing the newline on both sides holds for both parsers.
- Side effect, a fix: a `pre` whose static text starts with a newline kept it before only by luck of JSX trimming; the server's own newline now protects it.
- Differential subject `raw-text`: a `pre` that starts with two unbound holes whose text starts with a newline, a `pre` with a bound hole (hand-made pair with a label that starts with two newlines), an unbound hole in a `pre` and in a `textarea`.
- Sizes: no loader or helpers code change.
