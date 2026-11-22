# Outcome: fix-string-length

## Built

`readField` in `packages/idlip/src/client/patch/diff.ts` returns the length of a string for the field `length`. A hole such as `row.label.length` or `draft.length` now patches when the string changes length.

## Tests

- `packages/idlip/test/client/patch/string-length.test.ts`: top level, row by index and by key, no change at equal length, array length still works.
- Differential subject `string-length` (`test/differential/subjects/string-length.tsx`): a top-level `draft.length` hole and a row `item.label.length` hole.

## Cost

The todo loader file grew from 4062 B to 4082 B gzip -9 (+20 B). The e2e `loaderBudget` of 4096 B passes.

## Other primitives

Only strings have a field a hole reads (`length`). Numbers and booleans have none the grammar allows.
