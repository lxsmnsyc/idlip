# Outcome: docs-effects

## Built

Four guide pages in `website/docs/`, section `Guide`:

| Page               | `order` | Content                                                                                                                                            |
| ------------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `effects.md`       | 30      | `await` in a handler, the task and continuation steps, built-ins (`Random`, `Time`, `Dom.measure`), state after an await, errors, `await-*` rules. |
| `subscriptions.md` | 31      | `<Subscribe to input key on:value>`, the four stock sources, a custom source with `until` and `Time.sleep`, pull delivery, `subscribe-*` rules.    |
| `refs.md`          | 32      | `ref` names and tuple refs in `<For>`, the four `Dom` calls, calls after the patch, missing refs, `ref-form`, `ref-key`, `dom-call-position`.      |
| `global-events.md` | 33      | `<window>` and `<document>`, key tests, `on:` queued and `latest:`, the dev queue warning, `global-attr`, `global-children`.                       |

- Each page has a "Server, resume and unmount" section that says what is serialized and what stays in the browser.
- 6 new `tsx` samples, all compiled by `check:samples`. Each page names the test that runs the same behavior.
- `views.md`: the `Subscribe` paragraph now links to `subscriptions.md` and `effects.md` (one line, allowed by the brief).

## Deviations

- Orders 30 to 33, not 13 and up, to leave room for `docs-platform` after `resuming.md` (12).
- The brief says `<subscribe>`; the code is `<Subscribe>`.
- Proposal 0004 claims left out, because the code does not do them:
  - `on:x` with `latest:x` on one element is not an error.
  - A source error does not reach `<Try>`. The loader logs it.
  - There is no dev message log, and no dev check that a payload serializes.

## Stubs left

- None in the pages.

## Gotchas

- Bug on `batch/core`, for the orchestrator. A patch can add a `<window>` or `<document>` whose event type was not in the page at load. It never gets a listener. The early listener (`src/client/loader/listener.ts`) adds global listeners only in `add()`, which runs when a state record is pushed. Reproduced with `mount`: `let open = false`, `{open && <window on:keydown={press} />}`, click to open, dispatch `keydown`: count stays 0. `global-events.md` documents it as a limit with the workaround (keep the element, branch in the handler). A fix belongs in its own node.
- `await Time.sleep(ms)` in a handler is a built-in, so it holds the batch for `ms`: the state written before the await never shows. Measured with 200 ms. The page says so and points to subscriptions.
- `await` inside `if` or a loop is `await-placement`; `await-nested` is only for nested `try`, `catch` and `finally`. `await fetch(url)` is `await-callee`.

## Proposed learnings

- Probe each lifecycle claim with a throwaway `mount` test before writing it | the proposal and the code differ on several points | website/docs | no

## Verification

- `pnpm --filter website check:samples`: 34 samples, 0 problems.
- `pnpm --filter website build`: 19 pages written. The sidebar lists the four pages.
- `pnpm --filter website check:reference`: 94 exports, 0 problems.
- `check_prose.py` on the four pages and `views.md`: ok.
- Full check on the branch: `pnpm build`, `pnpm lint` (exit 0, warnings only), `pnpm format:check`, `pnpm typecheck`, `pnpm test` (659 passed), `pnpm --filter e2e test` (18 passed): pass.
- Self-review, one round: five prose fixes (wording of the error and built-in batch sentences, the global listener limit, "after calls"). No blocking findings.

## Size

- Estimated M, actual M.
