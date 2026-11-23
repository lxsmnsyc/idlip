---
'idlip': patch
---

A `style` attribute given an object renders as CSS text instead of `[object Object]`. Keys that start with `--` are written as given, other keys go from camelCase to kebab-case, `null`, `undefined` and `false` values are dropped, and numbers get no unit. A static object folds at compile time.
