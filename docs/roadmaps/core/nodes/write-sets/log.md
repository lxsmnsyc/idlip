# Log: write-sets

- Work did not exist at `batch/core`. Built the write analysis, manifest entries, parallel preload and the narrowed patch.
- Fixtures regenerated from `compile()`; `page.html` edited by script (handlers and tasks segments).
- Bench: cold first click 354 ms (2 RT) to 209 ms (1 RT). Loader 3958 B to 4126 B with the flag on.
- Done. Committed on `feat/write-sets`.
