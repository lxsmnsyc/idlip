# Waves 3 to 6: the todo-resumes milestone

All must nodes are done. Landed on `batch/core` in rolling mode: `compile-update`, `analyze-v9`, `vite-plugin`, `e2e-harness`, `props-method-path`, `compile-view-codegen`, `patch-bindings`, `ssr-render`, `compile-integration`, `row-list-exports`, `patch-lists`, `resume-loader`, `chunk-helpers`, `testing-mount`, `example-todo`.

Milestone result (`examples/todo`, production build, verified by a fresh reviewer in Chromium):

- Load: the document (1984 B gzip, with the inline listener) and the loader (3901 B gzip, budget 4096 B). No chunk loads and the state is not decoded before the first event.
- First checkbox click: `handler=toggle` (119 B) and `binding=todos.*.done` (505 B). A second click loads nothing.
- After toggle, type, Escape, add and toggle, the DOM equals a fresh server render. The e2e suite (10 tests) asserts the request set from page load on, the DOM equality and the budgets.

Contract changes this run (all in the contracts' Changes sections): `view-ir` v9 (block-bodied event arrows, impure globals in holes, rule ids from compile-update, `module-reserved-name`), `core-api` v9 (`renderListener`, multi-child `Try`/`Head`), `compiled-format` v9 (props before arguments in payloads, keyed `*` diff by key or index, topological group order, chosen row bindings run on every kept row with `l` exports in row chunks, helpers copied into chunks, listener phase by `event.bubbles`, loader budget measured minified, server render takes a model).

Nodes added during the run: `analyze-v9`, `props-method-path`, `row-list-exports`, `chunk-helpers`.

Open, not assigned:

- Source forms for `once`, `capture`, `passive`.
- An impure call hidden in a helper used in an event argument is not caught.
- Imported stateless components cannot read their own module helpers (`nesting`).
- Other roots continuing while one root waits on a failed chunk is untested (`multi-root`).
- `e2e/fixture/` stays for `E2E_TARGET=fixture`; delete when unused.

Gate: `example-todo` waits for the user's milestone review.
