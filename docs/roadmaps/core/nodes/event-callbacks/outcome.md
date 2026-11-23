# Outcome: event-callbacks

## Built

| Step | Commit    | What                                                                                                                                             |
| ---- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | `7e751a3` | Change requests `compiled-format-event-callbacks` and `view-ir-event-callbacks`.                                                                 |
| 2, 3 | `4e86caf` | Compiler, listener and loader in one commit: the attribute format changes, so the two halves cannot land apart with the differential test green. |
| 5    | `b741636` | Docs: views, forms, global events, nesting, subscriptions, resuming, reference.                                                                  |
| 4    | in step 2 | Global events, `<Subscribe>` events, forms and the child's own events go through the same function path, with tests.                             |

Design:

- **Attribute.** `on:click="$e3"`, `on:submit="$e0 prevent"`, `on:keydown="$e5 prevent:ArrowDown prevent:ArrowUp"`. A value that starts with `[` is the old JSON message, without placeholders, for data built at render: a message prop of a stateful child, a forwarded message prop and a `<Try>` reset.
- **Function.** `export function $e3($e, $c, { model, rendered, page: { props } })` in the handler chunk of the first handler the arrow calls. It returns `[tag, payload]` pairs. `$e` is the event (or a subscription value), `$c` the element, which the listener records because the browser clears `currentTarget`. The function is an entry of `manifest.handlers` under its name, with `bindings` (the union over its tags) and `tags`. The loader starts the chunks of every tag together with the function's chunk.
- **Row values.** `getRows$($c, rendered, lists)` reads the rows around the element from the markers and the model the DOM shows, so a row removed earlier in the same batch does not move the clicked row. `lists` holds a model path per list, or a function of the scope when `each` is not a path.
- **Loader.** `QueuedEvent` is `QueuedMessage | QueuedCall`. A call loads `manifest.sites[site]`, runs the function when its turn comes, then applies each returned message.
- **Source forms.** Leading `e.preventDefault()` and `e.stopPropagation()`; leading `if (<key test>) e.preventDefault();` for a conditional prevent (`prevent:<filter>` tokens, one per `||` alternative); a sole key `if` still filters in the listener; then handler calls, `if`/`else` on any view expression and `const`.
- **Errors that stay.** An `async` arrow (`event-closure`), a whole event as an argument (`event-placeholder`), a statement that is not a call, `if` or `const` (`event-statement`), an arrow with no call (`event-no-call`), a conditional prevent after an unconditional one (`event-prevent-twice`), an event read in a message prop (`event-message-event`), a message prop that is not one handler call (`event-message-body`), a message prop or reset next to other calls (`event-target-nested`). `event-computed-key` is gone.
- Tests: `test/client/loader/callbacks.test.ts` (two calls, a branch on a row, Enter with the field value, a conditional prevent, a batch that removes a row above the next click), differential subject `callbacks`, listener tests for site attributes and `prevent:`, no `$event` in any fixture page (`fixtures.test.ts`), analysis violations for the new rules.

## Acceptance

- [x] `on:keydown={(e) => { if (e.key === 'Enter') submit(e.currentTarget.value) }}` and an arrow that calls two handlers compile and run (tests and differential subject).
- [x] No `$event` path payloads in compiled HTML; `fixtures.test.ts` checks every fixture page.
- [x] Server HTML, first click and rows/dashboard numbers below. Nothing slower beyond noise.
- [x] Build, unit, differential, e2e (23 passed, 4 skipped), website tests, lint and format pass.

## Numbers

| Measure                                       | Base (`batch/core`)                            | Branch                                         |
| --------------------------------------------- | ---------------------------------------------- | ---------------------------------------------- |
| Rows SSR HTML, 1,000 rows, raw / gzip -9      | 336089 / 23929 B                               | 297877 / 17345 B                               |
| Todos SSR page (benchmark app), raw / gzip -9 | 5382 / 2162 B                                  | 5354 / 2124 B                                  |
| Dashboard SSR page, raw / gzip -9             | 96006 / 8616 B                                 | 102718 / 8664 B                                |
| Todo loader, gzip -9 (e2e method)             | 3991 B                                         | 4086 B (budget 4096 B)                         |
| Todo first click, files (toggle)              | handler 118 + helpers 2002 + binding 281 B raw | handler 264 + helpers 2527 + binding 281 B raw |
| Dashboard client JS in dist, raw / gzip -9    | 156561 / 106369 B                              | 160516 / 108536 B                              |
| Rows client JS in dist, raw / gzip -9         | 15488 / 7653 B                                 | 16630 / 8225 B                                 |

Timings (interleaved, runs fixed before: rows 9, first click 21; load 2.9 at start and 5 to 7 during rows, so the rows result is rough; a change counts above 3 times the larger MAD):

- Rows paint: create1k 28.6 ms base, 25.8 branch (within noise); replace1k 28.4, 28.9; append1k 56.7, 57.7; create10k 249.0, 238.0 (real, -4.4%: a row no longer runs a `setOn$` write).
- Dashboard first click, 150 ms latency, after idle: click to update 65.0 ms base, 63.0 branch; click to write 16.7, 16.6; frame after write 31.8, 32.1. Todos: 64.0, 60.0; 16.2, 15.9; 31.3, 31.5. All within noise. The click makes the same requests as before (e2e).

Reading: rows HTML falls 11% (27% gzip) because a row repeats no payload. The dashboard HTML grows 7% raw and 0.6% gzip because the props that handlers read now ride in the state script once, where before each event attribute repeated their values. The first click loads about 670 B more raw on the todo: the event function and `getRows$` in the helpers module.

## Deviations

- Steps 2 and 3 are one commit (see Built).
- The loader is 91 B larger and fits the budget with 9 B to spare. A cold click on an arrow with several handlers loads all their chunks in one round trip, and the loader loads every update before it runs the first message, so a chunk that fails drops the event whole.
- Edited `e2e/fixture/stub/listener.js`, `docs/roadmaps/core/nodes/event-callbacks/` and docs outside the owned paths, as the brief lists.

## Stubs left

- None.

## Gotchas

- An event function reads the DOM when it runs. Two `input` events that wait for a chunk both read the last value of the field, so the old test `a,ab,` is `ab,ab,`. The model ends the same.
- Message props of a stateful child are data built at render, so they still carry row values (`["remove",["a1"],"",""]`) and cannot read the event.
- `getRows$` stops at the `<!--n:...-->` boundary of the component that holds the element, so a child's rows are never mixed with the lists of its parent (test in `callbacks.test.ts`).
- An arrow that only cancels the event, with no handler call, is `event-no-call`.
- A key `' '` (the space bar) cannot be a filter: the modifier list splits on spaces. This was so before.
- Compilers that call `generate` and `compileHandlers` themselves must call `joinSites` (`src/compiler/sites.ts`).

## Proposed learnings

- Events are functions in the handler chunk, and only message props are data | the HTML carries no payloads and an arrow may branch | packages/idlip/src/compiler | yes

## Verification

`pnpm lint` (no errors), `pnpm exec oxfmt --check .`, `pnpm typecheck`, `pnpm build`, `pnpm --filter idlip test` (873 passed), website tests (133 passed), `pnpm --filter e2e test` with ports 4273 to 4275 (23 passed).

## Size

- Estimated L, actual L.
