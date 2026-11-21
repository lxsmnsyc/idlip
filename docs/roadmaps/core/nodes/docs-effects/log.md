# Log: docs-effects

- 2026-11-21: started on `feat/docs-effects`, reset to `batch/core` 9d42687. No pages existed.
- Probed each claim with `compile` and a throwaway `mount` test (deleted). Findings that differ from proposal 0004:
  - `await` in an `if` or loop is `await-placement`, not `await-nested`. `await fetch()` is `await-callee`.
  - `on:x` and `latest:x` on one element compile with no diagnostic. The page does not claim the error.
  - A source that throws is logged by the loader. It does not reach `<Try>`. No dev message log exists.
  - `await Time.sleep(200)` in a handler holds the batch: the state before the await never shows.
  - A `<window on:keydown>` absent at page load gets no listener when a patch adds it (keydown count stayed 0). The listener script adds global listeners only in `add()` at record push. Documented as a limit.
- Orders 30 to 33 in `Guide`, to stay clear of `docs-platform`.
