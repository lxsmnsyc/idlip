# Log: compile-view-analyze

- Ported prototype analyze.ts, ir.ts, nesting.ts into src/compiler/view/analyze/; split printing into print.ts. Fixtures stored as `.idlip.tsx.txt` under test/ so tsc, oxlint and oxfmt skip them.
- v8: impure globals in holes marked `impure: true`; `hole-impure` is a warning when the path set is not empty. Violations fixture changed on one line (`draft + Math.random()`); new fixture impure.idlip.tsx.txt.
- Printed output of counter, todo, edges, features equals the prototype's out/ byte for byte; JSON for counter and todo equal.
- Added `readImport` option: stateless imports inline against their own module, stateful ones stay child nodes; diagnostics map to the use site.
- Typed the AST with @oxc-project/types (was `any`): ~140 tsc errors fixed, lint went from ~1100 errors to 0. Renamed noun-named methods (pathsOf, text, error, extend, spanOf) per ts-style.
- Tests load fixtures through import.meta.glob ?raw, so no @types/node is needed.
- Review fixes: impure globals only in holes (`position` field: event args and message props give hole-global, state inits give let-init); markers for block-bodied Try catch, block-bodied For render, non-name For index; moved minimizePaths doc comment. Rebased onto batch/core.
