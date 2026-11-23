# Log: docs-platform

- Started on `batch/core` at 9d42687. No pages existed: the work was not done.
- Orders 20 to 26 in section Guide, after `resuming` (12), leaving 13 to 19 for `docs-effects`.
- Ran a Node server (`page.js`, `server.js`) against a build of `examples/todo`: CSP page, click loads 2 chunks, no console errors. `build.js` gets `no-store`, hashed files `immutable`.
- Ran three deploys behind that server with two open tabs: one build old works without reload, two builds old reloads once and then works. The reload drops the failed click.
- Wired `renderPreload` into a scratch copy of the todo entry with `Reflect.get` for `chunks` and `manifest`: tsc clean, 2 modulepreload links, 0 requests at the click. Reverted.
- Vercel: no CLI and no account here, so `vercel.json` and `api/page.js` were not deployed. `api/page.js` re-exports the handler that the Node run used.
- Probed each page's samples with `mount` in a scratch test (deleted): forms submit, `Dom.reset` and `Dom.focus`, head title order, SVG namespaces, URL drop, raw HTML, Try and reset, a hole that throws outside Try, dynamic holes.
- Found on `batch/core`: a hole in a `<For>` row that reads outer state is not patched when `each` is a prop, not state. The `mount` check fails with `attribute data-r is "2" in the page and "4" in the server render`. With `let items = props.items` it patches. The SVG sample avoids it.
- `new URL('./x', import.meta.url)` in a Vitest test under `packages/idlip` threw "The URL must be of scheme file". The testing page uses `join(import.meta.dirname, ...)`, as the repo's tests do. `website/docs/reference/testing.md` uses the URL form.
- happy-dom puts a server-rendered `<p>` inside `<foreignObject>` in the SVG namespace. A branch added by a patch is HTML. The SVG sample puts the condition inside `<foreignObject>`, the tested case.
- Self-review, one round: re-read the seven pages against the probes and the source. No change needed. Full check (build, lint through `rtk proxy`, format, typecheck, test, e2e 18 passed): pass.
