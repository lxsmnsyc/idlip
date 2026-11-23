# Outcome: plain-tsx

## What changed

- The `.idlip.tsx` extension is gone. The Vite plugin compiles every `.tsx` file that the `modules` globs match. Default `src/**/*.tsx`.
- A `.tsx` file outside the globs, or with no function component, is plain TSX and passes through to Vite. A component in a file outside the globs warns and names `modules`.
- The analyzer takes a component import from any source that ends in `.tsx`. Another source gives `X comes from Y, which is not a .tsx file`.
- Rendering a component from a `.tsx` file outside `modules` fails the build with: `/src/board.tsx renders a component from /lib/counter.tsx, which the idlip plugin does not compile. Add the file to the `modules`option of idlip(), for example`modules: ['src/**/*.tsx']`.`
- Renamed 28 `*.idlip.tsx` files and 10 analyzer fixtures (`*.tsx.txt`). Updated tests, expected outputs, examples, benchmarks, e2e, website docs, REPL, landing, demo and proposals.
- `getting-started.md`, `reference/vite.md` and `nesting.md` describe the new rule.
- New test `packages/idlip/test/vite/plain-tsx.test.ts` covers a child in the globs, the diagnostic, and same-named files in two folders.

## Decisions

- The option is named `modules`, not `include`. The diagnostic names `modules`. Renaming the public option was not asked for.
- Chunk names use the file base name, as before (`todo.handler.toggle`). Two files `a/todo.tsx` and `b/todo.tsx` share the chunk name. Before this node, `chunks.json` mapped both to one file, so the pages of `b` loaded the code of `a`. A separate `fix:` commit now matches each chunk to its bundle file by module id, and a test checks that the URLs and code differ.
- Removed the check that a compiled module uses a feature the client build dropped. It only fired for a compiled module outside `modules`, which no longer exists.
- Proposal 0005 (the `.idlip` markup file) keeps its `.idlip` text. It is a different file type.

## Checks

- `pnpm --filter idlip build` ok. `pnpm --filter idlip test` 671 passed.
- `pnpm --filter website build` 28 pages. `pnpm --filter website test` 66 passed. `check:samples` 47 samples, 0 problems.
- Benchmarks `build`, `build:rows`, `build:dashboard` and `build:scale` build.
- `pnpm -C e2e test` 18 passed, including the todo first-click chunk spec.
- `git grep idlip.tsx` is empty outside `docs/roadmaps/**`.
- `pnpm lint` still reports errors in `website/test/chart.test.ts` and `website/src/landing/benchmarks.ts`. They are outside this node and were not touched.

## Left

- Nothing from the brief. Windows paths are normalized to posix in the plugin but were not run on Windows.

## Review fixes

- A file in `modules` with no function component is skipped in the build, the transform and feature detection.
- Module paths are posix and the root is a real path, held in a `Set`.
- A component outside `modules` that Vite transforms gives a warning once. This costs one analysis per such file.
- A `component-import` error for `./counter` or `./counter.js` suggests the `.tsx` form.
- `features.tsx.txt` imports `./avatar.tsx`. Its recorded output now has no diagnostic.

## Follow-ups

- A project whose components live outside `src` needs a matching `modules` glob.
