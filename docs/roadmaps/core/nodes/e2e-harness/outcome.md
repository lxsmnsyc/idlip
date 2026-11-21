# Outcome: e2e-harness

## Built

- `e2e/`: workspace package `e2e` with `@playwright/test`. `pnpm --filter e2e test` runs 8 Chromium tests, about 2 s.
- `e2e/playwright.config.ts`: `E2E_TARGET` is `fixture` (default) or `example`. The `example` entry runs `pnpm --filter todo preview --port 4173 --strictPort`; `example-todo` must match that name and command, or edit the `targets` map. Both targets must answer `GET /?props=<json>` with the page rendered for `{ initial: [...] }`.
- `e2e/fixture/server.ts`: serves the golden todo fixture. It renders `expected/server.js` with the reference helpers, adds a nonce per request, and sends a CSP with `script-src 'nonce-…' 'strict-dynamic'`, `require-trusted-types-for 'script'` and `trusted-types idlip`. Chunks come from `expected/client/` by the `?idlip-<chunk>` query.
- `e2e/fixture/stub/{listener,loader,client}.js`: stubs of the head listener, the resume loader and the `idlip/client` helpers. The loader works from the manifest: it decodes the state on the first event, loads the handler chunk, picks changed groups minus covered ones, loads those chunks and patches `a` and `t` bindings. It does not patch lists.
- `e2e/tests/todo.spec.ts` and `support.ts`:
  - scripts off: the server render shows the todos and `1 left`.
  - strict CSP headers are present, the page raises no violation, and a nonce-less script or Trusted Types sink is blocked.
  - before the first event no chunk loads and the state function is never called.
  - the first click on a checkbox requests exactly `handler=toggle` and `binding=todos.*.done`, and decodes the state once.
  - a second click loads nothing.
  - a click while all script requests are held still applies after they are released.
  - the DOM after each of two clicks equals a fresh server render (attributes compared in name order).
  - gzip -9 size of the inline listener (limit 1024 B) and of the loader module with its static imports (limit 4096 B).
- A test fixture fails any test on a console error, page error, failed request or HTTP status 400 and above.
- `.github/workflows/check.yml`: installs Chromium with `playwright install --with-deps chromium` and runs `pnpm --filter e2e test`.

## Deviations

- `pnpm-lock.yaml` changed for the new package (the brief lists it as shared).
- Stubs stand in for `ssr-render`, `resume-loader` and `patch-lists`. The fixture server imports `reference.ts` from `packages/idlip/test/fixtures/` for rendering.
- Stub JS files start with `/* oxlint-disable */`: type-aware lint rejects untyped browser code.
- Tests count every non-document request after load, labeled by chunk name when it has one. `getChunkName` in `e2e/fixture/chunk.ts` is shared by the server and the tests, and is the one function `example-todo` may change.
- The e2e CI step runs on Node 24 only, with a cached Playwright browser. `e2e/package.json` requires Node 22.18 or later for type stripping.

## Stubs left

- Replace `fixture/stub/*` with the real `renderListener`, loader and client once `resume-loader`, `patch-bindings` and `ssr-render` land. The budget test reads the page, so it measures the real files when the server serves them.
- List patching is not exercised: `patch-lists` has no behavior to test yet. Add add, remove and reorder tests then.
- No test types into the input or submits the form.

## Gotchas

- Under `require-trusted-types-for 'script'`, a page-side `DOMParser` call is a sink, so the fresh render is parsed on a second page with scripts off.
- The Proxy on `self.$idlip` must keep the original `push` separate from the replacement the listener installs, or a listener that wraps the original recurses.
- The patched DOM writes attributes in another order than the server (`class` after `i-a`), so the test compares sorted attributes, not `outerHTML`.

## Proposed learnings

- Count chunk loads from network requests and state decodes from a wrapper on `self.$idlip` records | the tests then survive a runtime rewrite | e2e | yes, they run against the stub and the real runtime alike

## Verification

- `pnpm --filter e2e test`: 8 passed.
- `pnpm --filter idlip test`: 155 passed (after rebase onto `batch/core`).
- `pnpm typecheck`, `pnpm format:check`: pass.
- `./node_modules/.bin/oxlint --type-aware`: no errors in `e2e`.

## Size

- Estimated M, actual M.
