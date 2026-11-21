# client

- The loader (`loader/` with its static imports) has a 4096 B gzip budget (contract) with no optional features, and the e2e test `loaderBudget` holds the todo build to 3900 B. The budget is the loader with every flag off, not with every feature on. Code that only some apps use goes behind a `HAS_*` flag from `features.ts`. Why: every page pays for the loader before the first click.
- A new flag takes three edits: `declare const __IDLIP_HAS_NAME__` and `export const HAS_NAME` in `features.ts`, one line in `DETECTORS` in `../vite/features.ts`, and `if (HAS_NAME)` around the code. Why: the bundler can fold the branch only when the test is that exact form.
- A flag name must not appear in other code or in a string. Why: the plugin replaces the text.
- A chunk may import from `idlip/client` only what the loader already holds. Why: a chunk import that is not in the loader costs a third request on the first click.
- Tasks run through `runTask(host, task)` in `tasks/run.ts`. Do not add another path for an awaited call. Why: `apply` and the settle order depend on one.
- Flag-on cost, gzip -9 over the todo loader: `HAS_TASKS` +274 B, `HAS_KEYED` +124 B, `HAS_REFS` +550 B, `HAS_CHILDREN` +650 B, `HAS_SUBS` +937 B, `HAS_HEAD` +307 B, `HAS_ERRORS` with `HAS_RETRY` +606 B (`HAS_RETRY` alone +16 B), `HAS_SKEW` +60 B (plugin option, default on), `HAS_DYNAMIC` +122 B. Why: a change that grows one of them shows up against this list. Update the line when you move a number.
- Put a field or branch that one feature reads behind `...(HAS_X && { field })` or `if (HAS_X)`. Why: a plain field survives dead-code elimination, and a `Reflect.apply` of a union costs about 9 B a call over a typed call.
- Put code that only one feature needs in its own module with one call site behind its flag. Why: an unreferenced module drops out of the bundle (`head.ts`, `nesting.ts`, `errors.ts`).
- Reach `innerHTML` only through `parseHtml`. Why: it holds the one Trusted Types policy and the namespace wrapper.
- Learn the server's state with a script `import()` (`skew.ts` imports `build.js`), not a `fetch`. Why: a strict CSP such as `default-src 'none'` blocks `fetch`. Put a check that runs only after a failure in a served file and import it then, since the loader pays for every byte on every page.
- A remount (`hot.ts`) replaces the root's `body` element, not its children. Why: `findNode` caches nodes by root.
- Tests never wait a fixed time. Use `settled()` and `until` from `idlip/testing`. Why: tests under load failed twice on a fixed wait (`fix-flaky-tests`, `fix-flaky-tests-2`). The title update of `<Head>` is one tick after `settled()`.
