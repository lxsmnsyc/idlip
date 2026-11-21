# Log: nesting-format

- Read GOAL, CLAUDE, brief, compiled-format v9, view-ir v9, 0002 (Props and nesting). The work did not exist yet.
- Prior art, brumate (`docs/compiler.md`, Render modules): scope IDs from the parent's ID plus call position, and a child's client module loaded when its scope is made. Adopted the slot naming. Did not adopt the in-memory scope tree: the state script needs plain data.
- Design choices, in order:
  1. Child models live in one flat table `PageState.slots` (path to `{ module, model, props }`), not inside the parent's model. A flat map makes the loader's lookup and the removal a delete by key, with no immutable update along the path.
  2. Boundary `<!--n:<path>-->…<!--/n-->`. The path joins one slot per level with `/`. A slot is the site index plus loop and explicit keys, escaped so a part has no `/`, `:`, `-` or `>`.
  3. The listener is unchanged except for copying item 3 of the message (`owner`). The loader finds the path of the target from the boundary. A forwarded message prop carries its owner's absolute path in item 3, so passing it through several components still works.
  4. A parent's props binding `p<id>` has no node: it calls `setProp(path, name, value)`. A branch that is not rendered has no slot, so the call does nothing.
  5. A client-added child needs a first model and markup. New `view` chunk (`init`, `render`), imported statically by the parent's template chunk. Only emitted for a module that is rendered as a child (compile option), so the counter and todo goldens stay as they are.
  6. Nesting code in `src/client/nesting.ts` with one call site `installNesting(seams)`, for `runtime-flags`.
- Fixtures: `nested/counter` (child with `label`, a message prop `onRemove`, state `count`) and `nested/board` (position child `Spare` and a keyed `<For>` of children). Generated the two `page.html` files from the reference render and checked the text by eye.
- Shared files: `fixtures.test.ts` lists the nested fixtures, mocks the child module, skips `p` bindings in the node check, counts `view` as a chunk and has the nested checks. `reference.ts` has `slot`, `addChild`, paths in `createContext`, `uses` and the event union.
- Checks: `pnpm --filter idlip test` 415 passed. Typecheck of `idlip` passes. `pnpm typecheck` fails in `examples/todo` only because the package is not built in this worktree. oxlint is clean on the fixtures folder.
