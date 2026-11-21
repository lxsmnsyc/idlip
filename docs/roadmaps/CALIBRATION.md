# Calibration

Estimated size against actual work, one line per node.

| Node                 | Estimate     | Actual | Tokens  | Note                                                                                                                            |
| -------------------- | ------------ | ------ | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| core-api             | M            | M      | 151,809 | One review round.                                                                                                               |
| spike-chunk-split    | M            | M      | 207,848 | One review round.                                                                                                               |
| spike-view-analysis  | M            | M      | 351,763 | Two review rounds. The prototype is about 3,200 lines; the production analysis is likely L.                                     |
| jsx-types            | M            | M      | 122,665 | One review round. The orchestrator added meta, link and multi-child Try and Head afterwards.                                    |
| compile-view-analyze | M, resized L | L      | 314,743 | One review round. About 3,000 lines with typed oxc AST.                                                                         |
| compiled-format      | L            | L      | 463,269 | Two review rounds plus one fix. Three change requests.                                                                          |
| compile-update       | M            | M      | 264,692 | Two review rounds; payload order changed the contract.                                                                          |
| analyze-v9           | S            | S      | 173,608 | Added handler-mutate alias check on request.                                                                                    |
| vite-plugin          | L            | L      | 300,374 | Two review rounds; enforce pre was missed at first.                                                                             |
| e2e-harness          | M            | M      | 182,520 | One review round.                                                                                                               |
| props-method-path    | S            | S      | 132,199 | Fix node, proven.                                                                                                               |
| compile-view-codegen | M            | L      | 380,962 | Two review rounds; payload desync with compile-update.                                                                          |
| patch-bindings       | M            | M      | 292,156 | Two review rounds; row-binding gap.                                                                                             |
| ssr-render           | M            | M      | 184,442 | One review round.                                                                                                               |
| compile-integration  | S            | S      | 152,810 | One review round.                                                                                                               |
| row-list-exports     | S            | S      | 112,157 | Fix node, proven.                                                                                                               |
| patch-lists          | M            | M      | 248,442 | One review round plus seam swap.                                                                                                |
| resume-loader        | M            | L      | 344,397 | Two review rounds; size measured unminified at first.                                                                           |
| chunk-helpers        | M            | M      | 282,253 | One review round.                                                                                                               |
| testing-mount        | S            | M      | 261,031 | Two workarounds replaced before review.                                                                                         |
| example-todo         | M            | M      | 227,462 | One review round; goal verified in Chromium.                                                                                    |
| markup-syntax        | M            | M      | 151,894 | Grammar, fixtures and proposal; three open questions decided by the orchestrator.                                               |
| keyed-paths          | M            | M      | 166,682 | One review round; loader over budget and an undefined key lookup fixed.                                                         |
| custom-effects       | M            | M      | 261,751 | One clean review. Touched two tests of other nodes; the change request waited for the curator.                                  |
| run-tasks            | M            | M      | 206,720 | Loader bytes took most of the time; 243 B over budget until `runtime-flags`.                                                    |
| stock-sources        | S            | S      | 90,381  | No deviations.                                                                                                                  |
| benchmarks           | M            | M      | 170,193 | Merge-threshold comparison moved to `spike-chunk-merge`. Timings vary 20% with load.                                            |
| runtime-flags        | M            | M      | 175,734 | Budget meaning changed to the loader with no optional features.                                                                 |
| markup-parser        | M            | M      | n/a     | Story branch; `spent:` empty in the brief.                                                                                      |
| markup-lower         | M            | M      | n/a     | Story branch; `spent:` empty. One accepted change request (fixture fix).                                                        |
| errors               | M            | M      | 241,160 | Compiler and server half; no loader code, so 0 B flag off.                                                                      |
| errors-client        | M            | M      | 268,605 | Flag-on loader cost cut from +826 B to +606 B, still over the 300 to 500 B expected.                                            |
| prefetch             | M            | M      | 252,189 | Review moved `listens` into the manifest; the first version parsed markup. Opt-in.                                              |
| form-fields          | M            | S      | 161,054 | The grammar and the listener already supported event paths; 0 B.                                                                |
| hmr                  | M            | M      | 237,800 | The patcher caches nodes by root, so a remount replaces `body`.                                                                 |
| document-head        | M            | M      | 286,357 | Flag-on +307 B; per-block title state dropped for size.                                                                         |
| svg-and-html         | S            | S      | 244,570 | Binding is `a<id>`, no flag; review added `html-trusted` and `html-element`. Spent is high for S: JSX types for SVG and MathML. |
| safe-urls            | S            | S      | 93,333  | Review fix: objects and arrays are dropped too.                                                                                 |
| safe-urls-2          | S            | S      | 83,522  | The analyzer decides the URL kind, since the helper does not know the tag.                                                      |
| dynamic-paths        | M            | M      | 363,165 | Tracked holes only at the top level of a root; rows, branches and children use static fallback.                                 |
| deploy-skew          | M            | M      | 364,832 | First version checked in the loader (+166 B); moved to `build.js` (+60 B).                                                      |
| loader-trim          | S            | S      | 149,933 | 126 B cut over eight small edits, 4007 B to 3881 B.                                                                             |
