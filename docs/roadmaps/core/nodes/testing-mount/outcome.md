# Outcome: testing-mount

## Built

- `packages/idlip/src/testing/index.ts`: `mount(source, props, options?)` returns a `MountedPage` with `root`, `get`, `text`, `click`, `input`, `settled`, `loaded` and `stop`. Options: `check` (default `true`), `id`, `nonce`.
  - It compiles with `compile()`, runs the server module with `render()`, puts the markup in a `div` in `document.body`, runs the early listener and the state script, and starts the loader with a patcher built from `createPatch(patchList)`.
  - Chunks come from memory: the state record's chunk ids map to `data:` URLs, and `loaded()` lists the chunk names in the order they were evaluated.
  - After a settled step with `check`, it re-renders the view on the server from the last patched model and compares the result with the page. A difference throws and names the path of the first node, attribute or text that differs.
- `packages/idlip/src/testing/modules.ts`: import binding and data URLs.
- `packages/idlip/src/testing/compare.ts`: tree compare. Adjacent text nodes merge, empty text is dropped, and `value`, `checked` and `selected` compare as live properties.
- `packages/idlip/src/client/loader/resume.ts`: `resume()` returns `stop()`.
- `package.json` exports `idlip/testing`, and `tsdown.config.ts` builds it (`dist/testing`).
- `packages/idlip/test/testing/`: `mount.test.ts` (10), `server-model.test.ts` (2), `settled.test.ts` (3).

## Acceptance

- [x] `idlip/testing` exports `mount`, in the package exports and the build entries.
- [x] `mount(todoSource, { initial })` renders and resumes in happy-dom. `click`, `input`, `settled` work (add and toggle tests).
- [x] First checkbox click: `loaded()` is `['handler=toggle', 'binding=todos.*.done']`.
- [x] With `check` on (default), a six-step run (toggle, type, submit, toggle, toggle, type) matches the server render at each step. A node edited by hand and left unpatched fails with `<button>` named. `check: false` skips it.
- [x] `page.stop()` removes the listeners and the loader's queue hook. A click after it loads nothing.

## Deviations

- `src/client/loader/resume.ts` (not owned): `resume(boot, patch, onError?)` returns `{ stop, settled }`; `onError` gets every error the loader reports (handler, chunk load, patch, dropped tag). `stop` empties the queue, blocks later patches and restores `q.push`. `settled()` resolves when no flush runs and no event waits for a chunk; events behind a failed chunk stay queued and do not hold it.
- `src/compiler/view/codegen/index.ts` (not owned): the server default export is `Component(props, context, model?)`. With a model, each state field reads `model.<name>` instead of its initial value. `ServerRender` in `src/core/format.ts` gains the optional third parameter. Golden `server.js` of the counter and todo fixtures changed, and two test files (`test/compiler/compile/compile.test.ts`, `test/compiler/view/codegen/codegen.test.ts`) match the new signature in a regex. `mount` calls the default export directly with a no-op context and the patched model for the re-render.
- The brumate repo was not at `../brumate` relative to the worktree. I read it at `/Users/alexis/Documents/GitHub/brumate`.

## Stubs left

- None.

## Gotchas

- `page.settled()` rejects with the first error reported since the last settle (a throwing handler, a failed chunk, an unknown tag). Later ones are dropped.
- One page at a time: `mount` throws "Stop the previous page first" while another is live. `stop()` also deletes `globalThis.$idlip`.
- A `<textarea>` compares by its live `value`; its child text is ignored (not tested, since the compiler rejects a hole in a textarea).
- `mount` needs a global `document` (use `// @vitest-environment happy-dom`). It sets `globalThis.$idlip` and adds window and document listeners until `stop()`. Call `stop()` after each test.
- Imports other than `idlip/server` and `idlip/client` in a source are not resolved in memory.
- The check found no bug in the todo run through add, toggle and typing.

## Proposed learnings

- Test a patcher against a fresh render of the same model | a stale binding shows as a DOM difference | packages/idlip/test | yes, `mount` does it

## Verification

- `pnpm --filter idlip exec vitest run test/testing` (the brief's verify): 15 passed.
- `pnpm --filter idlip test`: 353 passed (20 files).
- `pnpm format:check`, `pnpm typecheck`, `pnpm build`: pass. `oxlint --type-aware`: no findings in the new files.

## Size

- Estimated S, actual M.
