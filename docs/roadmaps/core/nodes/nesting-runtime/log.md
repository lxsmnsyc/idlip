# Log: nesting-runtime

- Rebased onto batch/core after nesting-compile landed. Built against the regenerated nested goldens.
- A child component is a `Root`-shaped object (`path`, `gen`, `top`), so `getUpdate`, `apply`, `runTask` and `patch` run on it unchanged.
- The node index is cached by root, so tests that reuse `document.body` must clear it. The nest harness calls `addBlock` on a loose comment.
- A chunk copy in `node_modules` is run by Node, not Vite, so the nest harness writes copies to `test/client/nest/.chunks`.
