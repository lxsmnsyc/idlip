# Log: bench-rows

- 2026-11-21 20:17: start on `batch/core` 087996d, load 7.60. Verify fails before the work: the harness has no rows scenario.
- Harness: copied brumate's `client.mjs`, `rows.mjs`, `rows.d.mts`, `dashboard.mjs`, `worker.mjs`, `serve.mjs`, `report.mjs`, `run.mjs` and the dashboard half of `browser.mjs`, then put back the idlip changes (idlip build, labels, the todos count reader). Added `hasScenario()`: a scenario other than todos needs a `build:<scenario>` script, so Qwik and brumate 0.3.0 stay todos-only and their columns drop out of the rows and dashboard tables.
- brumate and marko: copied `rows/` and `dashboard/` from brumate's repo, added `build:rows`, `build:dashboard`, `loadRows()`, `loadDashboard()`.
- idlip rows: `rows/src/app.idlip.tsx` with `<For key="id">`. The first build failed: handlers that import `harness/rows.mjs` share a chunk, which the vite plugin rejects. Fixed with a loader entry (`rows/src/loader.ts`) that imports `idlip/client` and re-exports the row operations, and the plugin's `client` option. All 9 operations and the 3 resumed clicks are expressible, swap included.
- First rows run, `--runs 1 --rounds 1`, load 9.23: passes for all three, no failed checks. idlip is behind on create, append, select, swap, remove and the first select and remove from a server page.
- Dashboard: added an idlip writer to `harness/dashboard.mjs`. First build failed with `hole-spread` on `Math.max(...items)` in the summary; moved it to a module-level helper. `<For>` needs a key field, so the list renders from derived `{ index, value }` entries. Quick run passes for all three.
- Not split: both scenarios fit the node.
- Recorded run at bea75fe (later squashed), harness load 11.09 at the start, 3.91 at the end, 887 s. 11-round ssr-speed rerun: rows SSR rate is not a loss (979 vs 946), dashboard is (1,382 vs 4,588 and 6,359).
- Profiles: create and append in Chrome (parseHtml per row dominates), dashboard SSR in Node (mergeState and seroval over a 76 kB state script).
- Review fixes: README loss table now has the Likely cost column; one load set (harness); stamp names batch/core 087996d plus this node's commit; the dashboard click check also compares the summary and every list item with the Node result. `bench --scenario dashboard --only idlip,brumate,marko --rounds 1` passes after it.
