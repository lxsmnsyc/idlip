# Log: stock-sources

- Started from `batch/core`. Nothing existed under `src/sources`, `core/time.ts` or `core/random.ts`.
- `src/sources/channel.ts` holds `listen`, a bounded callback-to-generator bridge shared by all four sources. It ends on abort without needing `return()`.
- Tests import `../../src/index.ts`, because the `idlip` entry needs a build.
- `Random` and `Time` keep the core-api names and signatures, so `custom-effects` can copy them into handler chunks.
- Change request written for the source names.
