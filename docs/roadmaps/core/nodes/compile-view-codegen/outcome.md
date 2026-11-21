# Outcome: compile-view-codegen

## Built

- `packages/idlip/src/compiler/view/codegen/`: `generate(ir, source, id)` returns `{ server, client, manifest, diagnostics }`.
  - `server`: the server module (helpers, `manifest`, `chunks`, a render function that calls `context.state`).
  - `client`: the binding group chunks (`binding=<key>`) and the list item template chunks (`list=<id>`). Handler chunks are not included: they come from `compile-update`.
  - `manifest`: handlers (with continuation tags), groups sorted and with `covers`, lists with `key`, `path`, `bindings` and `parent`, and the event types.
  - Files: `plan.ts` (binding ids, anchors, groups, covers), `expr.ts` (IR expressions to JS, server and client modes), `html.ts` (markup builder for the server, list rows and condition branches), `events.ts` (DOM message, modifiers, props payload), `chunks.ts`, `module.ts` (copies module-level helpers and the imports they need, types removed), `text.ts`, `index.ts`.
- Tests in `packages/idlip/test/compiler/view/codegen/codegen.test.ts`: 37 tests. The todo fixture is analyzed from its real source. For both fixtures: the manifest equals `manifest.json`, the server module renders exactly `page.html` (state script included) with the reference helpers, the manifest and chunk map equal `server.js`, the set of client files equals the fixture's, each binding chunk equals the fixture after oxfmt, and the list template renders the same rows as the fixture chunk. Other tests cover modifiers, the props payload, literal `$` arrays, global listeners, helper copy, renamed locals, unpatched holes, condition branches with scope, lists, the svg namespace, nested lists and diagnostics.

## Deviations

- The test strips the runtime helper aliases (`setText as setText$`) before comparing binding chunks with the fixtures. Server module and list chunk text differ from the fixtures in style: markup is one template literal, not `'a' + ...` pieces, and the row accumulator is `rows$`. They are compared by running them, not by text. Binding chunks match as text.
- A text hole, condition or attribute without a state path is not marked and has no binding (root props never change). Its id is still used.
- A hole directly inside `<textarea>` or `<title>` cannot hold comment markers. It renders without them, and the diagnostic `codegen-raw-text` is given when it reads state.
- Unsupported for now, reported as `codegen-unsupported` errors: `<Try>`, `<Head>`, `<Subscribe>`, child components, `ref`, `html`, and events that target a prop or `reset`.
- `?.` in an optional path is printed between every segment, since the IR keeps one flag per path.

## Stubs left

- None. `listHandlerProps` is imported from `compiler/update`.

## Gotchas

- A row binding that reads state outside the list (`class={selected === t.id}`) gets a group of its own (`selected`). `patch()` runs row bindings only through `patchList` for rows whose item changed, so a change to `selected` alone would not run it. That is a gap for `patch-lists`, not something codegen can fix.
- The root component is the first exported stateful one, else the first stateful one (the rule of `compile-update`, repeated in `index.ts`: the update module does not export its picker).
- Groups are ordered so a group precedes every group it covers. Ties keep the longest path, then the key, so the fixtures' order is unchanged.
- Runtime helpers are imported as `name as name$`. `manifest` and `chunks` are reserved local names.
- Passive types are not marked in `manifest.events` (`click:passive`). `ssr-render` may need them for the state record.
- `PageState.props` holds the props fields that any client chunk reads (`props: { min: props.min }`).
- A helper that the analysis inlines is not copied. Module helpers are found by name and copied with their types removed.
- Locals that clash with generated names (`text`, `rows`, `props`) get a `$` suffix. List accumulators are `rows$`.

## Proposed learnings

- Compare generated code by running it where its text style is free, and by oxfmt-normalized text where the shape is fixed | text style differs while behavior is the same | packages/idlip/test/compiler | yes

## Verification

- `pnpm --filter idlip exec vitest run test/compiler/view/codegen`: 37 passed.
- `pnpm --filter idlip test`: 197 passed, after rebasing onto `batch/core`.
- `pnpm typecheck`, `pnpm format:check`: pass.
- `./node_modules/.bin/oxlint --type-aware`: 0 errors, a few `max-depth` warnings in `plan.ts` and `events.ts`, and the analysis warnings.

## Size

- Estimated M, actual L. Module helper copy, scope handling and the condition and list templates took more than planned.
