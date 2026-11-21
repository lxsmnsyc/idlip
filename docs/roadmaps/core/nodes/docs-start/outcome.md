# Outcome: docs-start

## Built

Four guide pages in `website/docs/`, in sidebar order after `index.md`:

| Page                 | Section | `order` | Content                                                                                                                                                                                              |
| -------------------- | ------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getting-started.md` | Start   | 1       | Empty folder to a running todo app: tarball install, `vite.config.ts`, `tsconfig.json`, the component, the server entry, `vite` dev and build. Also how to run `examples/todo`.                      |
| `components.md`      | Guide   | 10      | `let`, `const`, handlers, `return`, props, the body rule, the `satisfies T as T` form, the compiled `toggle`, common errors.                                                                         |
| `views.md`           | Guide   | 11      | Holes and the closed grammar (allowed operators and methods), class and style, URLs and `trusted`, conditions, events, forms, `<For>`, `<Try>`, `<Head>`, `<Subscribe>` (named only), common errors. |
| `resuming.md`        | Guide   | 12      | Server output, the two requests before the first event, the steps and two requests of the first click, write sets, early clicks, `renderPreload` (off by default).                                   |

- 14 `tsx` samples, all compiled by `check:samples`. The todo component on `getting-started` is `examples/todo/src/todo.idlip.tsx` without its header comments.
- Error ids named: `body-statement`, `let-annotation`, `let-bare-as`, `let-unassigned`, `handler-mutate`, `handler-impure`, `view-map`, `hole-global`, `hole-method`, `jsx-spread`, `event-closure`, `event-placeholder`, `event-computed-key`, `attr-event`, `html-trusted`, `srcdoc-trusted`, `hole-dynamic`. Each one except `hole-dynamic` was reproduced with `compile` on a small module.
- Request counts and bytes on `resuming` come from the `example-todo` outcome and `e2e/tests/todo.spec.ts`: 2 requests before the first event (5885 B gzip -9), 2 at the first click (`handler=toggle`, `binding=todos.*.done`, 624 B), 0 at a second click.

## Deviations

- The `views` page follows the "After debate `debates/dsl`" section of the brief: TSX views with block components, no markup DSL.
- `getting-started` installs `idlip` from a tarball, because npm `idlip@0.0.1-stage` is a placeholder that exports only `.`. The page says `pnpm add idlip` replaces it after the 0.1 release.
- `getting-started` runs `vite` dev and `vite build`. It does not write a production server. It points to `examples/todo/vite.config.ts`, which finds the hashed loader in the client manifest.
- `<Subscribe>` gets one sentence and no sample. Effects and subscriptions belong to `docs-effects`.
- No files outside the owned paths and `nodes/docs-start/`.

## Stubs left

- `views.md` says effects and subscriptions have their own page, without a link. `docs-effects` can add the link.
- The `getting-started` install section changes once `release-0-1` publishes `idlip`.

## Gotchas

- A function assigned to a `let` compiles with no diagnostic, though `docs/proposals/0002-modules.md` calls it a compile error. The pages do not claim the error.
- `hole-dynamic` is no longer reported for holes (`dynamic-paths` outcome). The pages list it as rare.
- `pnpm --filter idlip pack --pack-destination ..` writes relative to `packages/idlip`. The page uses `"$PWD/.."`.
- Through the `rtk` wrapper, `pnpm lint` exits 1 with only warnings. `rtk proxy pnpm lint` exits 0.

## Proposed learnings

- Probe each documented rule id with `compile` before naming it in a page | proposals describe rules that the compiler does not report yet | website/docs | no

## Verification

- `pnpm --filter idlip build`: pass.
- `pnpm --filter website check:samples`: 14 samples, 0 problems.
- `pnpm --filter website build`: 6 pages written. The sidebar lists Introduction, Getting started, Components and state, Views, Resuming.
- Getting-started steps run in an empty folder outside the repo: install, `tsc`, `vite` dev with a Playwright click and submit (no console errors), `vite build`: pass.
- Full check: `pnpm build`, `pnpm format:check`, `pnpm typecheck`, `pnpm test` (659 passed), `pnpm --filter e2e test` (18 passed): pass. `pnpm lint`: exit 0 with `rtk proxy`, warnings only.
- `check_prose.py` on the four pages: ok.

## Size

- Estimated M, actual M.
