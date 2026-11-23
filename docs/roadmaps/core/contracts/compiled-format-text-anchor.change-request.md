# Change request: compiled-format, text that fills an element

From node `text-anchor`.

The contract says every text hole is `<!--t<id>-->value<!--/t-->` with the binding `t<id>`. A bound text hole that is the only child of its element now has no comments: the element's `i-a` lists the hole id and the binding is the element binding `a<id>`.

## Change

In the export names paragraph, add "the text of an element whose only child is a bound text hole" to the list of `a<id>` bindings.

Replace the **Text** bullet with:

- **Text.** A text hole is `<!--t<id>-->value<!--/t-->`. An empty value still writes both comments. A bound text hole that is the only child of an HTML, SVG or MathML element writes no comments: its id goes last in the element's `i-a`, its binding is `a<id>`, and the binding sets the element's text (`setText$` with the element, as for a `<textarea>`). This does not apply in `script`, `style`, `textarea` and `title`, whose text is not markup, and in `pre` and `listing`, whose parser drops a newline that starts the text. A client template writes the same markup: the element with its `i-a` and a text node, or no node for an empty value.

In the `setText` row of the helper table, add: "Given an element, sets its text."

## Why

- The loader finds elements by `i-a` and the name `a<id>`, and `setText$` already sets an element's text. The loader, the patcher, the row node maps and the helpers do not change, so the change costs no loader bytes and needs no flag.
- SSR HTML, raw / gzip -9: rows (1,000) 362089 / 24331 B to 336089 / 23928 B, todos (100) 22720 / 3498 B to 21120 / 3479 B, dashboard 99887 / 8739 B to 95887 / 8587 B. Each filled hole saves 16 B (`<!--tN--><!--/t-->` minus ` N` in an `i-a`) or 10 B (minus a new ` i-a="N"`).
- `pre` and `listing` keep the comments. Without them, the server's `<pre>\nx</pre>` parses to `x` while a clone or a patch writes `\nx`. happy-dom keeps that newline, so the differential test cannot see this case. The rule follows the Chromium check of `cloned-templates-all`.
