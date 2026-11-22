# Log: short-chunk-names

## 2026-11-22

- Branch `node/short-chunk-names` from `batch/core`.
- The state's chunk map is keyed by the full Vite module id (`/src/widgets/Widget00.tsx?idlip-handler=run&lang.js`) and valued by the URL. The key is not the file name, so a short file name shortens only the value.
- Apps set `chunkFileNames: 'assets/[name].[hash].js'` themselves (`examples/*`, `benchmarks/idlip/*`, `website/src/demo/build.ts`). The plugin only sets the emitted chunk `name`. So the cheapest experiment is `chunkFileNames: 'assets/[hash].js'`, no plugin change. It is also the shortest possible name that still busts caches, and a hash of module path and chunk id (xxh32) would only add characters to it.
- Measured (script in the scratchpad, `renderPage` output, `<script i-state>` only), readable names then hash-only:

| Page                  | raw before | raw after | gzip before | gzip after |
| --------------------- | ---------- | --------- | ----------- | ---------- |
| todo (examples/todo)  | 2,236      | 2,017     | 762         | 718        |
| rows, 1,000 rows      | 38,311     | 38,049    | 6,644       | 6,574      |
| dashboard, 50 widgets | 62,558     | 55,541    | 4,797       | 5,177      |

- The dashboard state gets 380 B larger in gzip. Whole page gzip: todo 2,151 to 2,098, rows 24,333 to 24,193, dashboard 8,739 to 9,117. Preload link bytes (raw) fall 1,603 to 1,113 on the dashboard.
- Why: the 8-character content hash is the same in both builds (364 distinct URLs each) and is random, so gzip pays about 6 B per URL for it either way. Readable names add repeated text that gzip matches. Removing them saves raw bytes, not wire bytes. The dashboard chunk map is 31,217 B raw and 2,949 B gzip of 62,514 and 4,754, and 364 hashes alone are about 2.2 kB gzip.
- Shorter hashes: rolldown refuses `[hash:6]` ("for this number of chunks (currently 65), you need a minimum hash size of 7"). It already detects too-small hashes, so no extra collision check is needed for content hashes. An id hash such as xxh32 would need its own check and still needs Vite's content hash for cache busting, so it is longer than hash-only.
- Reverted the experiment. No code change kept.
