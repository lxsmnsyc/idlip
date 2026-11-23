# Outcome: fix-style-object

## Built

A `style` attribute given an object renders as CSS text on the server and in client patches. Keys that start with `--` are written as given, other keys go from camelCase to kebab-case, `null`, `undefined` and booleans are dropped, and numbers get no unit. Values are escaped like other attributes. Static objects of literals fold at compile time (`foldStyle` in `compiler/view/analyze/analyze.ts`). Dynamic ones convert in `joinStyle$` of `core/helpers.ts`, used by `attr$`, `setAttr$` and `putAttr$`. `StyleValue` types the attribute. `website/docs/styles.md` shows both forms.

## Tests

`packages/idlip/test/style-object/`: static object, dropped `null` and `false`, custom property, camelCase key, string form unchanged, dynamic object patched on click, and an object in a `<For>` row (cloned template path). Each click test runs `settled()`, which compares with a server render.

## Cost

No loader change: the conversion lives in the shared helpers module. The todo loader stays at 4087 B gzip, and the e2e `loaderBudget` of 4096 B passes.

## Not done

No differential subject (`test/differential/subjects.ts` is not an owned path).
