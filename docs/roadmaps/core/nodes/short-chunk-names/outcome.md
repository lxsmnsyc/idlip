# Outcome: short-chunk-names

## Decision: drop

Short chunk file names save raw bytes and lose wire bytes on the page that matters, so nothing ships. No code, test or contract changed.

## Numbers

`<script i-state>` of the server render, bytes. "After" is a build with `chunkFileNames: 'assets/[hash].js'`, the shortest name that still busts caches (an xxh32 of module and chunk id plus Vite's content hash is longer). Gzip is node `zlib` level 9.

| Page                  | raw before | raw after | gzip before | gzip after |
| --------------------- | ---------- | --------- | ----------- | ---------- |
| todo demo             | 2,236      | 2,017     | 762         | 718        |
| rows, 1,000 rows      | 38,311     | 38,049    | 6,644       | 6,574      |
| dashboard, 50 widgets | 62,558     | 55,541    | 4,797       | 5,177      |

Whole page gzip: todo 2,151 to 2,098, rows 24,333 to 24,193, dashboard 8,739 to 9,117 (+378 B).

## Why it does not pay

- The content hash is random and the same in both builds (364 distinct URLs on the dashboard), about 6 B of gzip each, roughly 2.2 kB of the chunk map's 2.9 kB gzip. Readable names are repeated text, which gzip nearly removes. Dropping them cuts raw bytes only, and on the dashboard the changed literal mix makes gzip worse.
- No name can go below the hash. Rolldown refuses a hash shorter than 7 characters at 65 chunks (it checks the hash size against the chunk count, so it also covers collisions of content hashes). An id hash of 32 bits would need its own collision check and Vite's content hash on top.
- The names are also load-bearing: e2e `fixture/chunk.ts` and its tests read chunk names from file names, the demo build (`website/src/demo/build.ts`) drops the hash to show names, and the `?preload` and REPL views use them. Hash-only files would need `.idlip/chunks.json` mapping in all of them.

## Where the bytes are

On the dashboard the chunk map is 31,217 B raw and 2,949 B gzip of the 62,514 B raw and 4,754 B gzip state. The bulk of the raw size is the keys: the full module id plus `?idlip-handler=run&lang.js` for every chunk, 364 times. A map grouped by module (`chunk-map-by-module`, row 7 of `brumate-lessons`) would cut raw bytes more than any file name can, but its gzip gain is bounded by the hash floor above, about 0.7 kB of 4.75 kB. Weigh it as a raw-size and parse-cost change, not a wire change.

## Recommendation

Drop `short-chunk-names`. Keep `[name].[hash]` in the apps. Collision handling needs no code: rolldown fails the build when the content hash is too short for the chunk count. Loader unchanged (todo 4,044 B gzip, dashboard 4,880 B).

## Checks

Not run: nothing changed in code. Docs only.
