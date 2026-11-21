# Log: loader-trim

- Measure: `pnpm build`, then gzip -9 of the loader and its static imports from the todo client manifest (the loader is one file). Baseline 4007 B.
- Each change was built and measured alone. Kept only the ones that shrank it.
- Tried and dropped: `paths.push(...group.paths)` in `getPlan` (+3 B).
