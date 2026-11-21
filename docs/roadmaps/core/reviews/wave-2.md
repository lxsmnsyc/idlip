# Wave 2

Landed on `batch/core` (local, not cut):

- `jsx-types` (2e02b74): intrinsic elements, `on:*` and `latest:*` props, `<window>` and `<document>`, `html={trusted(...)}`.
- `compile-view-analyze` (9ee3658): the production analysis, ported from the spike with a typed oxc AST. 73 of 74 rule ids tested. Impure globals are allowed only in holes and attribute values.
- `compiled-format` (fb0c506): frozen at v8. Events are data in `on:*` attributes, modifiers come from plain TypeScript (`e.preventDefault(); add();`, `if (e.key === 'Escape')`), the state script is decoded on the first event, a `<head>` listener queues early events (1024 B gzip; loader 4096 B gzip, including `idlip/client`). Binding chunks cover groups they imply, so the first toggle loads `toggle` and `todos.*.done` only. Under a keyed list, a `*` path changes when it differs by key or by index. Chunk ids are `<root-relative module>?idlip-<kind>=<name>&lang.js`; vite-plugin writes the URL map and ssr-render puts the page's entries in the state record.

Contracts: `view-ir` v9 (block-bodied event arrows for modifiers, four new rule ids; v8 earlier allowed impure globals in holes with a warning), `core-api` v9 (`renderListener`; v8 earlier let `Try` and `Head` take several children), `compiled-format` v8 frozen.

Plan changes:

- New node `analyze-v9` (S, must): the analysis still reports the modifier forms as `event-closure`. `compile-integration` waits for it.
- Follow-ups recorded in briefs: `compile-integration` re-exports the analysis from `idlip/compiler`; `nesting` lets imported stateless components read their own module helpers.
- Open: no node owns `once`, `capture` and `passive` source forms; an impure call hidden in a helper used in an event argument is not caught.

Gate: `compiled-format` waits for the user. Nine nodes are ready after it: `compile-update`, `compile-view-codegen`, `vite-plugin`, `analyze-v9`, `e2e-harness`, `patch-bindings`, `patch-lists`, `resume-loader`, `ssr-render`.
