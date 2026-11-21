# Outcome: props-method-path

## Built

- `packages/idlip/src/compiler/view/analyze/analyze.ts`:
  - `recordProps` stops a props path before a called member: `props.list.indexOf(by)` and `list.indexOf(by)` (pattern field) read `list`; `props.user.tags.map(f)` reads `user.tags`. `props.onSave()` keeps `onSave`.
  - `decodeEntities` decodes JSX text: `&lt; &gt; &amp; &quot; &apos; &nbsp;`, a few more named ones (`copy reg hellip mdash ndash middot bull times laquo raquo`), `&#65;` and `&#x41;`. An unknown name stays as written. Codegen can escape once.
- `packages/idlip/src/compiler/update/handlers.ts`: a props path found in the body but missing from `listHandlerProps` is now the error `handler-props-unlisted`, and the chunk is not emitted. Before, it was appended to the payload.
- JSX string attribute values decode the same entities; a braced string does not.
- Tests: `test/compiler/update/handlers.test.ts` (payload `[props$list, by]`), `test/compiler/view/analyze/analyze.test.ts` (paths before a called method, entities).

## Proof

- base: e0ae57e (`batch/core`), `pnpm --filter idlip exec vitest run test/compiler` with the new tests: 3 failed, 119 passed. The chunk was `find(model, [props$list$indexOf, props$list, by])`, the path was `props.list.indexOf`, and the text kept `&lt;` undecoded.
- branch: same command: 124 passed.

## Deviations

- The brief says "and a state path". Handler `free` lists paths for props only, so there was no state path to stop.
- No source reaches `handler-props-unlisted`, so its test passes `compileHandlers` an IR whose `free` paths were emptied.

## Stubs left

- None.

## Gotchas

- `compile-view-codegen` should use the decoded text from the IR as is and escape once.
- The entity table is short on purpose. Add names to `ENTITIES` in `analyze.ts` when needed.

## Proposed learnings

- None.

## Verification

- `pnpm --filter idlip test`: 160 passed.
- `pnpm typecheck`: no errors. `pnpm format:check`: clean. `./node_modules/.bin/oxlint --type-aware`: 0 errors, only the existing `no-thenable` and `no-template-curly-in-string` warnings.

## Size

- Estimated S, actual S.
