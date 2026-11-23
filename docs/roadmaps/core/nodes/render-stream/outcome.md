# Outcome: render-stream

## Built

- `packages/idlip/src/server/stream.ts`: `renderToStream(component, props, options?)` returns a `ReadableStream<string>` of the whole document, and `streamParts(parts, options?)` streams what `renderPage` returned. `StreamOptions` extends `RenderOptions` with `loader` (URL of the loader module), `preload` (`renderPreload` options or `false`) and `head` (markup at the start of `<head>`).
- Chunks, after the user's decision of 2026-11-23 (brumate's split): the first chunk is the whole first render: doctype, `<head>`, `options.head`, listener, loader script, preload links, `<Head>` output, `<body>` with the markup and the state script. The pending chunks follow, then `</body></html>`; with nothing pending the tail is in the first chunk. This replaces the brief's early head flush: idlip renders synchronously, so it gains nothing. The nonce is on the listener, the loader script, the state script and each preload link.
- `RenderResult.pending: AsyncIterable<string>`: the hook for `stream-model`. It is empty (`NOTHING_PENDING`) until data arrives. The stream reads one chunk per pull, and `cancel` calls `return()` on the iterator, so the pending work stops in its `finally`. A render error fails the stream before it sends a byte. Change request `contracts/core-api-render-stream.change-request.md`.
- The stream is one explicit phase union (`first`, `pending`, `done`). `renderSync` is exported from `render.ts` for it.
- Docs: `reference/server.md` (`renderToStream`, `streamParts`, `StreamOptions`, `pending`), `deploying.md` (a section with the Node pipe and the Vercel `Response`).
- Tests: `test/server/stream.test.ts`, 11 tests.

## Acceptance

- The first chunk holds the head, then the body, then the state script; the joined stream equals the document built from `renderPage` for a stub with `<Head>` output and for the fixtures counter, todo, try and effects: pass. The brief's "head chunk before body chunk" became "head before body inside the first chunk".
- Nonce on each script and link, no loader or links when asked, a throwing component fails the stream, pending chunks go after the first chunk, `return()` runs on cancel: pass.
- Dashboard SSR throughput, `ssr-ab.mjs dashboard speed`, 3 runs each: `renderPage` and string concat 4,650 renders/s, `renderToStream` read to a string 4,550. Within noise (the runs of one side spread over 4,518 to 4,737).
- `pnpm lint`, `pnpm exec oxfmt --check .`, `pnpm typecheck`, `pnpm build`, `pnpm --filter idlip test`, `pnpm --filter website build`, website tests, e2e on ports 48851 to 48853: see the report.

## Deviations

- `render()` still returns the body string. `renderPage` is the equivalent of brumate's `render` (parts plus `pending`). Changing `render` would break every caller; left to the coordinator.
- `StreamOptions.head` is a string for the document head. `entry-setup` removes the need when the document is a component.

## Gotchas

- A render error fails the stream before any byte, so a host that reads the first chunk before it writes headers can answer 500. `streamParts` takes a result from `renderPage`, for the host that needs the parts first.
- `examples/*` and `benchmarks/*` still build the document by hand; `entry-setup` moves them.

## Verification

- `pnpm --filter idlip exec vitest run test/server`: 38 passed.
