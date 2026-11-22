# Log

- Renamed 28 `*.idlip.tsx` files and 10 `*.idlip.tsx.txt` analyzer fixtures, then replaced `.idlip.tsx` by `.tsx` in every file outside `docs/roadmaps/**`.
- The analyzer now accepts an imported component from any source ending in `.tsx`. The bare `.idlip` source form is gone.
- Plugin: `MODULE_FILE` is `/\.tsx$/`, then `isModule` checks the `modules` globs. A `.tsx` file outside them is left to Vite.
- Recorded analyzer outputs had spans that shifted with the shorter text. Updated the file snapshots and regenerated `counter.json` and `todo.json`.
- Removed the "dropped feature" check in the transform and its test. A compiled module is always one of the counted modules now.
- e2e: port 4173 was busy, so it ran with `E2E_PORT=48611 E2E_COUNTERS_PORT=48612 E2E_SUBS_PORT=48613 E2E_HOT_PORT=48614`. 18 passed.
