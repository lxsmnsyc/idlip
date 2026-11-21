# Log: example-todo

- Started on `batch/core` at 4d217ac. No `examples/` folder existed, so no prior work.
- `examples/todo`: the fixture source as is, `entry-server.ts` with `render(url, { loader, nonce })`, `vite.config.ts` with the plugin, a `loader` client input with the Vite manifest, and a preview middleware that renders `/` with a nonce and the fixture's CSP.
- First build: loader 4597 B gzip -9, over 4096 B. Vite wraps the loader's `import(url)` in its preload helper because tsdown drops the `/* @vite-ignore */` comment when it splits the ternary inside `import()`. Fix in `resume.ts` (resume-loader code): the import sits alone in `importChunk(url)`, so the comment survives. Loader now 3934 B.
- `vite preview` listened on `localhost` only (IPv6), so Playwright timed out on 127.0.0.1. Set `preview.host`.
- `getChunkName` parses built names `<module>.<kind>.<name>-<hash>.js`.
- `E2E_TARGET=example`: 8 passed. Dev server checked by hand with a Playwright script: toggle, type, Escape, submit, toggle of the new row all patch; the first click loads `handler=toggle` and `binding=todos.*.done`.
- Default e2e target switched to `example`, per GOAL acceptance. Added an add/Escape/toggle test, skipped on the fixture target.
- Review fixes: the test before the first event records all requests from `goto` (an appended eager `import()` of `todo.list.3` now fails it), file names `[name].[hash].js` with a `getChunkName` test for hashes with `-`, an own `push` on the `watchState` queue, `idlip:` warnings fail tests, `server.ts` dropped from the example tsconfig.
