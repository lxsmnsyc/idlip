# bench-scale: outcome

## Answer

**Partly.** The claim "Your app grows. Its startup doesn't." holds for JavaScript and script time. It does not hold for total bytes, and idlip is not the only framework that stays flat.

Data: `benchmarks/README.md`, section "Scale". 10, 50, 200 and 1,000 distinct widgets, idlip, brumate 0.8.1, Marko 6 and Qwik 2. All 16 builds worked and every page passed its checks (all widgets in the HTML and the DOM, the first click shows what Node computes, no page errors).

| Measure (gzip -9)                | idlip, 10 to 1,000 widgets | brumate 0.8.1 | Marko 6      | Qwik 2             |
| -------------------------------- | -------------------------- | ------------- | ------------ | ------------------ |
| JS before `load`                 | 4.7 kB at every size       | 15.9 to 201.5 | 5.9 to 117.8 | 37.3 at every size |
| JS before the first click        | 4.7 kB at every size       | 15.9 to 201.5 | 5.9 to 117.8 | 51.2 to 1,409.1    |
| All bytes before `load`          | 8.1 to 116.7 kB            | 17.8 to 305.3 | 7.6 to 205.8 | 42.7 to 432.1      |
| All bytes before the first click | 8.1 to 116.7 kB            | 17.8 to 305.3 | 7.6 to 205.8 | 56.6 to 1,803.9    |
| Script time to `load`, 4x CPU    | 2.5 to 3.1 ms              | 5.0 to 17.6   | 7.4 to 124.5 | 2.6 to 5.1         |

"All bytes" is the HTML, the JS and every other fetch. Only Qwik 2 has other fetches (`bundle-graph.json`: 1.0 kB at 10 widgets, 92.2 kB at 1,000).

- **Yes for JS on load.** idlip loads one 4.7 kB file (12.5 kB raw) at every size. The first click adds about 1 kB. brumate grows 12.7x and Marko 20x.
- **Yes for script time.** idlip stays at 2.5 to 3.1 ms. Marko grows 17x and brumate 3.5x.
- **No for total bytes.** All bytes grow 14x for idlip (8.1 to 116.7 kB), because idlip writes each widget's state and listeners into the HTML: 2.0 MB raw at 1,000 widgets, 3.5x Marko's. It is still the smallest total from 50 widgets up (116.7 kB against 205.8 kB for Marko at 1,000). At 10 widgets Marko is smaller (7.6 against 8.1 kB).
- **Not unique.** Qwik 2 also keeps JS on load (37.3 kB, 8x idlip) and script time flat. Its JS before the first click grows only because it preloads every widget while idle (4,004 files at 1,000 widgets). That is background work after `load`.
- **Task time does not separate them.** Whole main-thread time to `load` (parse, layout, script) grows for every framework, 52 to 451 ms for idlip and 53 to 387 ms for Qwik 2, mostly because of the DOM. The frameworks are within about 30% of each other.

## Landing page

`website/src/benchmarks.json` has four new groups, one metric per size with labels "10 widgets" to "1,000 widgets". The headline is "JS on load, by app size" (before `load`), so Qwik 2 shows its flat 37.3 kB and not its idle preload. The landing copy needs two corrections that sit outside this node's paths (`website/src/landing/benchmarks.ts`):

- The lead says "a bigger app adds almost nothing to what the page loads". True for JS, not for HTML. Say "JavaScript" instead of "what the page loads".
- The foot says "JavaScript loaded before the first click". The chart now shows JS before `load`. Reword it.
- "Qwik 1" has no values, so the foot says it "ran only on the smaller app". It did not run at all.

## Method notes

- Timings come from the third of three runs, which had the lowest load. The 1-minute load average before and after each size was 2.00 and 2.22 (10 widgets), 2.22 and 2.34 (50), 2.34 and 2.84 (200), 2.84 and 3.16 (1,000). That is about the 3 that the timings need, only the last size ends slightly above it. The two earlier runs (1-minute loads of 2.4 to 8.2, and 3.4 to 4.8) agree on script times within about 20% and show the same order. Their task times at 1,000 widgets differ by 30% (idlip 481 and 614 ms), so use task times as an order of magnitude. Rerun `node benchmarks/harness/scale.mjs run` on a quiet machine to tighten them.
- Bytes are exact. Across runs, brumate's gzip moved by a few bytes. Everything else was identical.
- Widgets are distinct modules with their own seeded code, but built from 17 handler steps and 12 formatters, so 1,000 of them repeat a lot. gzip likes that, Marko's single file most.
- "Before the first click" is load plus a 3 s idle wait, as in the existing README tables.

## Changes

- `benchmarks/harness/scale.mjs` (CLI, build, serve, measure, page checks, report), `scale.test.mjs`, and small changes to `dashboard.mjs` (`widgets(count)`, exported `WRITERS`, `write(framework, folder, count)`), `frameworks.mjs`, `serve.mjs`.
- `scale/` projects for idlip, brumate, marko and qwik2 (new, since Qwik had no dashboard), a `loadScale()` in each adapter, a `build:scale` script in each `package.json`, and ignore rules for the generated code.
- A page that fails its checks, a build that fails, or a server that does not start in 60 s is reported as `failed` with the reason. The test covers the page check with fake entries.
- A build spawned from `node --test` hangs when it inherits `NODE_TEST_CONTEXT`, so `buildApp` removes it.
- The test builds each framework at 10 widgets and fetches the page from a server process.
