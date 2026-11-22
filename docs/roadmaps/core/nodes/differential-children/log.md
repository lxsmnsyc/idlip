# Log: differential-children

- `mount` gets `children()` and `patchChild(path, model)`: a second decode of the state script gives the slots, the manifest of each child module and the chunk urls. The patch runs the child's page (root, path, start comment) through `createPatch` and records the slot model for the check. The loader's `resume` exposes no units, and a change there would cost loader bytes (budget 4096 B).
- The test walks each child through 40 generated models (`mutateModel` from its model, keys from its manifest). The check compares the whole page with a server render from the slot models.
- Removed the `clicks` restriction of the four child subjects: the check renders children from slot models, so clicks on child buttons pass.
- Mutation proof: dropping the slot record in `patchChild` fails 4 subjects.
