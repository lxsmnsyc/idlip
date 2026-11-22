# Log: differential-render-test

- Read brumate's test. It renders pages through the server and through the browser output and lists accepted differences. idlip has one codegen for both, so the second output here is the client chunks: a binding chunk patches a branch, a list chunk renders a row, a view chunk renders a child.
- `mount` already compares a patched page with a server render after each `settled()`, but only for states a handler reaches. The new test adds states a handler does not reach: it renders model A on the server, patches the DOM to model B through the real `createPatch`, and compares with the server render of B.
- States come from the model the server recorded. A seeded generator keeps each field's type, flips booleans, picks strings and numbers from small pools (markup, quotes, line breaks, empty), and for a list drops, edits, appends, reorders and keeps keys unique.
- The comparison is `compareTrees` from `src/testing/compare.ts`: it joins adjacent text, reads live `value` and `checked`, and drops `i-head`. The test adds the list of accepted divergences on top of it.
- Children: `mount` took one source, so a parent with a child could not mount. Added the `children` option (a source per import specifier). The server-render check also read the model of the last patched page, which was the child's after a child patch. It now takes the root's only.
- A check of the check: breaking `setBranch$` (wrong branch number), and `addChild` (wrong label) each fail the test.
- Not done: `effects` fixture (imports `./api.ts`, one source only), and the model-driven pairs for subjects with children (the patch of a child needs the nesting state of the loader). Children run through handlers with the server-render check.
