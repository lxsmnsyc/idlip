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

## Step 5: text holes directly in a table or a select

- Chromium check (`playwright-core`, a probe page that runs copies of `parseHtml` and `clone$`): the parser leaves comments where they are in a `select` and in a `colgroup`, and keeps text in a `select`. A template's hole is a comment at parse time, so the template parse never moves it; the clone matches the server in a `select`. In a `colgroup` the server's text moves before the table and its `<!--/t-->` with it, so no clone can match it, and patching it was already broken.
- The analyzer already rejects text in `table`, `tbody`, `thead`, `tfoot` and `tr` (`html-nesting`). It now rejects text in `colgroup` too (one word in `analyze.ts`, outside the owned paths). With that, a text hole in a table or a select clones like any other, and `TEXT_PARENT_TAGS` goes. The brief's "anchor on the parent element" is not needed: the comment mark is the anchor, and the parser leaves comments in place.
- The probe also confirmed steps 3 and 4 in Chromium: SVG and MathML wrappers give the right namespaces (`foreignObject` content is HTML), and a `pre` or `textarea` with the server's leading newline matches the template plus its write.
- Differential subject `select-text`: holes directly in a `select` in rows and in a branch, table rows. `template.test.ts`: a colgroup text hole is `html-nesting`, a select hole clones.
- Sizes: no loader or helpers code change.

## Step 6: `<Try>`, `<Subscribe>`, `<Head>`, global listeners and `<template>` content

- `<Try>` in a body is `<!--e<id>:x<n>--><!--/e-->`. The body clones inside a `try` block into `$nc<n>`, the catch view in the `catch` block (with `error` declared as on the server), and only then the state goes on the start comment and the nodes after it, so a throw leaves no half-written nodes. Templates `templateE<id>_0$` (body) and `templateE<id>_1$` (catch view). A `reset` in a catch view writes `["$reset",[id]]` as the server does (`catching` in the clone context).
- The `try=<id>` chunk: `render(error, scope, doc)` clones the catch view (a static one renders HTML until step 8), and `region(scope, start)` clones the whole region (`templateR<id>$`) in `start.ownerDocument`. `errors.ts` takes a node or HTML: it wraps a cloned catch view in its region comments and swaps the nodes in. HTML stays for the static catch view until step 8.
- `<Subscribe>`: `<!--c<id>:s--><template i-sub>` with `i-input` and `i-key` written by `putAttr$(..., JSON.stringify(value))`, as `attr$` wrote them, and events as on elements.
- `<Head>` (client form): `<!--c<id>:h--><template i-head>`. Its elements go in the template's content, which the walk of `clone$` does not enter, so when they write a value they clone from their own template (`templateH<id>$`) and the write appends the fragment to `.content`. A title with a hole sets its text.
- An author `<template>` with a write inside does the same (`templateT<offset>$`).
- Global listeners: `<template i-global>` with events.
- Element start tags, events and anchors share `openTag`, `addEvents` and `addAnchor`.
- Differential subject `block-kinds`: `<Subscribe>` with input and key in a row, `<Try>` in a row (kept rows that recover keep the catch view: the accepted divergence `caught-region-stays` now lists this subject too) and in a branch with a reset, a global listener that reads the state, a `<template>` with holes. A `<Head>` binding reads `document.head`, which the model-pair harness leaves out (with HTML too), so `template.test.ts` mounts a branch with a cloned `<Head>` and checks the title and the meta.
- Goldens of the `try` fixture rewritten (`UPDATE_TRY=1`).
- Sizes: todo loader 4073 B, helpers 969 B (no change; the `errors.ts` change is behind `HAS_ERRORS`).

## Step 7: dynamic holes

- `plan.ts` makes a hole dynamic only at the top of a root view (no rows, no blocks, not a child: "Rows, blocks and children render from templates that record no reads"), and that part renders on the server only. So no client body holds one today. The template writer no longer refuses one: a dynamic text, attribute or text-element hole prints through `printTracked` (`track$(dynamic, 't<id>', model, (model) => ...)`), as `HtmlBuilder` did, and the scope takes `dynamic` and `model`.
- No differential subject can reach it, so `template.test.ts` builds a branch from a plan whose holes are all marked dynamic and checks the writes and the scope.
- Sizes: no loader or helpers code change.
