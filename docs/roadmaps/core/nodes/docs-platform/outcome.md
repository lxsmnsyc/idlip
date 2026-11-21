# Outcome: docs-platform

## Built

Seven guide pages in `website/docs/`, section Guide, after `resuming` (12):

| Page               | `order` | Content                                                                                                                                                                                                                                                 |
| ------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `head.md`          | 20      | `<Head>`, its rules and error ids, the last title in page order wins, child ranking, `renderPage()` `{ head, body }`, the async title update.                                                                                                           |
| `svg-and-html.md`  | 21      | SVG and MathML namespaces, `foreignObject`, `html={trusted(v)}` with no sanitizing, the four rule ids, Trusted Types, bound URL checks.                                                                                                                 |
| `forms.md`         | 22      | Fields as event paths on submit (`value`, `checked`, `valueAsNumber`), submit prevented, `event-computed-key`, a field in state, `Dom.reset` and `Dom.focus`.                                                                                           |
| `errors.md`        | 23      | `<Try>`, `reset`, catch view not patched and its node limits, a throwing hole outside `<Try>`, throwing handlers, chunk failures and the retry, `idlip:error` `{ error, path }`, `expectCaught`.                                                        |
| `dynamic-paths.md` | 24      | Paths the compiler finds (inlined helpers, arguments), dynamic holes recorded on the server, the `$dynamic` chunk, rows and children fall back to static paths, `props-whole`, `hole-dynamic`.                                                          |
| `testing.md`       | 25      | Vitest with happy-dom, `mount`, `click`, `input`, `settled`, `loaded`, `stop`, the server check, errors and `expectCaught`, head titles, limits.                                                                                                        |
| `deploying.md`     | 26      | Build output, a Node server and a Vercel config, skew (no-store `build.js`, keep `dist`, one reload two builds old), `renderPreload` (221 ms to 60 ms), the missing types for `chunks` and `manifest`, the dev server (`swap`, `remount`, full reload). |

- 25 new `tsx` samples, 39 in the site, all pass `check:samples`. Each sample was also run through `mount` in a scratch test, deleted before commit.
- Orders used: 20 to 26. 13 to 19 are free for `docs-effects`.

## Deviations

- Vercel: the config was not deployed (no Vercel CLI or account on this machine). `api/page.js` re-exports the same `page.js` handler that the Node run served. The Node setup was run from `examples/todo`: build, serve, and a Chromium click (2 chunks, no console errors). Three deploys followed with two open tabs. The tab one build old worked, the tab two builds old reloaded once and then worked. The orchestrator decides whether that meets "run once" for Vercel.
- The deploy files (`page.js`, `server.js`, `api/page.js`, `vercel.json`) live only in the page. They were created in `examples/todo` for the run and removed, since `examples/` is outside the owned paths.
- No files outside the owned paths and `nodes/docs-platform/`.

## Stubs left

- `views.md` still names effects and subscriptions without a link (`docs-effects`).
- `deploying.md` says an app cannot import `chunks` and `manifest` with types and shows a `Reflect.get` cast. Update it when a typed export lands.

## Gotchas

- Bug on `batch/core`: a hole in a `<For>` row that reads outer state is not patched when `each` is a prop, not state. Repro: `<For each={props.items} key="id">{(item) => <li data-r={big ? 4 : 2}>…</li>}</For>` with `let big` toggled by a handler. `mount` fails: `attribute data-r is "2" in the page and "4" in the server render`. With `let items = props.items` and `each={items}` it patches. Needs its own fix node.
- In a Vitest test under `packages/idlip`, `new URL('./x', import.meta.url)` passed to `readFileSync` threw "The URL must be of scheme file". `website/docs/reference/testing.md` uses that form; `testing.md` uses `join(import.meta.dirname, ...)`.
- happy-dom parses a server-rendered `<p>` inside `<foreignObject>` as SVG. Branches added by a patch are HTML.
- A dynamic hole's chunk (`$dynamic`) loads with every handler that writes a path, even when no dynamic hole read it.
- I ran `pkill -f "node server.js"` once to stop my scratch server. It matches any process with that command line on the machine.

## Proposed learnings

- Run each guide sample through `mount` before publishing | a sample that compiles can still behave unlike the text. Two claims here changed after a run | website/docs | yes, a test could mount every `tsx` block

## Verification

- `pnpm --filter website check:samples`: 39 samples, 0 problems.
- `pnpm --filter website build`: 22 pages written.
- `pnpm --filter website check:reference`: 94 exports, 0 problems.
- `oxfmt --check website/docs`: clean. `check_prose.py` on the seven pages: ok.
- Full check: `pnpm build`, `rtk proxy pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm --filter e2e test` (18 passed): pass.

## Size

- Estimated M, actual M.
