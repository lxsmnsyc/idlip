# Outcome: example-todo

## Built

- `examples/todo` (workspace package `todo`):
  - `src/todo.idlip.tsx`: the todo as a function component, the same source as the golden fixture `packages/idlip/test/fixtures/todo/todo.idlip.tsx`. Ids come from a `next` counter in state, the form submit calls `e.preventDefault()`, and Escape clears the draft through a key test.
  - `src/entry-server.ts`: `render(url, { loader?, nonce? })` returns the page: `renderListener()` in `<head>`, the loader module script, and the body from `render()` of `idlip/server`. `?props=<json>` sets `{ initial: [...] }`. In dev the loader defaults to `/@id/idlip/client`.
  - `vite.config.ts`: `idlip({ entry: '/src/entry-server.ts' })`. The client input is `{ loader: 'idlip/client' }` with `build.manifest`, so the server finds the hashed loader file. Client files are named `assets/[name].[hash].js`: a hash may hold `-`, and the `.` keeps it apart from the chunk name. A `configurePreviewServer` middleware serves `GET /` from `dist/server/entry-server.js` with a nonce per request and the fixture's CSP (`script-src 'nonce-…' 'strict-dynamic'`, `require-trusted-types-for 'script'`, `trusted-types idlip`). `preview.host` is `127.0.0.1`.
  - Scripts: `dev`, `build`, `preview`, `typecheck`.
- `e2e`: the default target is now `example` (`E2E_TARGET=fixture` still serves the fixture). `getChunkName` in `e2e/fixture/chunk.ts` also reads built names `<module>.<kind>.<name>.<hash>.js`, where a `_` segment of a binding path is `*` (`tests/chunk.spec.ts` covers hashes with `-` and `_`). The test before the first event records every request from `goto` on and expects the document plus the loader and its static imports, nothing else; an eager `import()` of `todo.list.3` appended to the built loader makes it fail. `watchState` gives the queue an own `push`, so the loader no longer warns `renderListener() is missing`, and an `idlip:` console warning fails a test. New test: Escape clears the input, submit adds a row, the new row toggles, and the DOM equals a fresh server render after each step (skipped on the fixture target, whose stub loader does not patch lists).

Acceptance:

- [x] `pnpm --filter todo build` and `pnpm --filter todo dev` work. Dev was checked with a Playwright script: toggle, type, Escape, submit and a toggle of the new row patch the page, with no console error.
- [x] The e2e tests pass against the example: 10 passed.
- [x] Bytes before and after the first click: below.
- [x] `E2E_TARGET=example` runs `pnpm --filter todo preview --port 4173 --strictPort`, and `GET /?props=<json>` renders the page for `{ initial: [...] }`.

### Bytes loaded

Built files, raw and gzip -9 (Node `zlib`, as the e2e budget test measures). `vite preview` serves them uncompressed.

Before the first click:

| Request                                                               | Raw     | gzip -9 |
| --------------------------------------------------------------------- | ------- | ------- |
| `GET /` (document, inline listener 1660 B / 962 B gzip, state script) | 4514 B  | 1984 B  |
| `GET /assets/loader.<hash>.js` (no static imports)                    | 9880 B  | 3901 B  |
| Total                                                                 | 14394 B | 5885 B  |

First checkbox click:

| Request                                           | Raw    | gzip -9 |
| ------------------------------------------------- | ------ | ------- |
| `GET /assets/todo.handler.toggle.<hash>.js`       | 118 B  | 119 B   |
| `GET /assets/todo.binding.todos._.done.<hash>.js` | 940 B  | 505 B   |
| Total                                             | 1058 B | 624 B   |

A second click loads nothing.

## Deviations

- Source fix in `resume-loader` code, `packages/idlip/src/client/loader/resume.ts`: the dynamic import moved into `importChunk(url)`. tsdown split `import(/* @vite-ignore */ cond ? a : b)` into two imports and dropped the comment, so Vite wrapped them in its preload helper and the built loader was 4597 B gzip -9, over the 4096 B budget. With the import alone in a function the comment reaches `dist`, and the loader is 3901 B.
- `e2e/playwright.config.ts` default target switched from `fixture` to `example`, so `pnpm --filter e2e test` runs against `examples/todo` as GOAL.md asks. It needs `pnpm build` first, which CI and the full check already do.
- `e2e/tests/todo.spec.ts` gained one test. The brief does not ask for it, and `e2e-harness` listed it as missing.
- The compiled output equals the fixture, since the source is the same file. No compiler change.

## Stubs left

- `e2e/fixture/` (server and `stub/*`) stays for `E2E_TARGET=fixture`. It can be deleted once nobody needs the fixture target.

## Gotchas

- Keep annotation comments such as `/* @vite-ignore */` out of expressions the bundler rewrites. Rolldown keeps the comment only when the node it sits on survives.
- `vite preview` listens on `localhost`, which can be IPv6 only. Playwright waits on `127.0.0.1`.
- The e2e `example` target serves the last build. Run `pnpm build` after changing `packages/idlip` or the example.
- `getChunkName` maps every `_` segment to `*`. A model field named `_` would be misread; the fixture scheme has the same limit.
- The server bundle inlines `idlip/server` (83.9 kB) because Vite treats the workspace link as source.

## Proposed learnings

- Measure the loader in a Vite app build, not only with rolldown alone | Vite adds its preload helper around every dynamic import that lacks `@vite-ignore` | packages/idlip/src/client | yes, the e2e budget test runs against the built example

## Verification

- `pnpm install`, `pnpm build`: pass.
- `./node_modules/.bin/oxlint --type-aware` (`pnpm lint` misreports its JSON): 0 errors; the warnings are in other nodes' compiler and test files.
- `pnpm format:check`, `pnpm typecheck`: pass.
- `pnpm test`: 353 passed (20 files).
- `pnpm --filter e2e test` (default, example): 10 passed. `E2E_TARGET=example`: 10 passed. `E2E_TARGET=fixture`: 9 passed, 1 skipped.
- Mutation: `import("/assets/todo.list.3.<hash>.js")` appended to the built loader fails the test before the first event with `script /assets/todo.list.3.Dl2IjM7-.js` as the extra request.

## Size

- Estimated M, actual M.
