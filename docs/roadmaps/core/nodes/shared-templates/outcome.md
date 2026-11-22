# Outcome: shared-templates

## Built

| Step | Commit    | What                                                                                                                                                      |
| ---- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `f4653d9` | A template that more than one chunk renders is declared once in `idlip/templates` and imported by each chunk. A template of one chunk stays in its chunk. |
| 2    | `6350741` | `clone$` reads the parse from the template (`k`) for the first document, with a WeakMap (`m`) for any other.                                              |
| 3    | dropped   | The encoded walk was built and measured. Same speed, larger helpers module, so it was not kept.                                                           |

Step 1 design:

- `Module.templates` lists each chunk's templates by hash (cyrb53 of namespace and markup, 14 hex digits). `GenerateOptions.shared` is the set of hashes to import. The Vite plugin compiles every module, counts the chunks per hash, and compiles again with the set.
- One virtual module `idlip/templates` (`\0idlip-templates`) exports `t<hash>` for each shared template. One module, not one per hash, because the loader cannot learn which template files a chunk needs within its 4096 B budget. The chunk map key is `templates` (`TEMPLATES_KEY`). The loader (`getUpdate`) and `renderPreload` load it next to `helpers`. The first click is still one round trip.
- `checkChunkImports` allows the templates file. If the bundler puts the templates in the helpers file, the key is omitted.
- Dev and the REPL compile without `shared`: each chunk declares its templates, so the dev server and HMR need nothing new.
- Tests: `test/vite/shared-templates.test.ts` (two components with identical markup: the HTML is in one client file, a single-chunk template stays inline), `test/compiler/view/codegen/shared-templates.test.ts`, a preload case, and a walk test in `template.test.ts`.

## Numbers

Template copies (`dup.py`, clean builds): dashboard 51 templates, 1 in 100 chunks (99 extra copies, about 4455 B raw) before, 0 extra copies after. Scale: 0 extra copies after (the brief's baseline: 1 template in 20 chunks).

|                                             | Base (batch/core)     | Branch                |
| ------------------------------------------- | --------------------- | --------------------- |
| Dashboard client JS in dist (harness)       | 365, 153.4 / 104.2 kB | 366, 152.9 / 103.9 kB |
| Dashboard client JS, raw and gzip -9 summed | 157120 / 106590 B     | 156561 / 106295 B     |
| Scale client JS, raw and gzip -9 summed     | 42670 / 25900 B       | 42671 / 25939 B       |
| Dashboard first click, widget 1, no preload | 4 req, 2.3 / 1.4 kB   | 5 req, 2.4 / 1.5 kB   |
| Dashboard widget 30 on click                | 3, 999 / 700 B        | 3, 999 / 701 B        |
| Total JS after 3 widgets, no preload        | 11, 16.2 / 7.4 kB     | 12, 16.4 / 7.5 kB     |

The saving is small because the copied template is small. The first click without preload fetches the templates file as a fifth request in the same round trip. Scale ends 39 B gzip larger: one more file and an export wrapper outweigh the removed copies.

Timings (interleaved, N fixed before the run, load 2.9 to 3.2 at start and end; a change counts above 3 times the larger MAD):

- Rows, N=15, paint: create1k 31.5 ms base, 30.4 branch (steps 1 and 2) and 31.3 (with step 3); replace1k 30.7, 30.3, 29.7; append1k 56.5, 57.8, 57.6; create10k 248.3, 245.3, 248.5. All within noise.
- Dashboard first click, N=21, 150 ms latency, after idle: click to update 63.0 ms base, 65.0 ms branch; click to write 16.4, 16.9; frame after write 31.8, 31.9. All within noise.

Step 3: the helpers module went from 1391 to 1632 B raw and 763 to 879 B gzip (dashboard build), with no speed change on rows. The rows template is shallow, so walking from the root costs little. Dropped by the brief's rule.

## Checks

`pnpm lint` (no errors), `pnpm exec oxfmt --check`, `pnpm typecheck`, `pnpm --filter idlip build && pnpm --filter idlip test` (including the differential test), and `pnpm --filter e2e test` with free ports pass.

## Open

- The templates file loads whole on the first click, so an app with many shared templates pays for all of them. A per-hash split needs the loader to know a chunk's template files.
- Dev does not share templates.
