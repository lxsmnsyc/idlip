# Calibration

Estimated size against actual work, one line per node.

| Node                 | Estimate     | Actual | Tokens  | Note                                                                                         |
| -------------------- | ------------ | ------ | ------- | -------------------------------------------------------------------------------------------- |
| core-api             | M            | M      | 151,809 | One review round.                                                                            |
| spike-chunk-split    | M            | M      | 207,848 | One review round.                                                                            |
| spike-view-analysis  | M            | M      | 351,763 | Two review rounds. The prototype is about 3,200 lines; the production analysis is likely L.  |
| jsx-types            | M            | M      | 122,665 | One review round. The orchestrator added meta, link and multi-child Try and Head afterwards. |
| compile-view-analyze | M, resized L | L      | 314,743 | One review round. About 3,000 lines with typed oxc AST.                                      |
| compiled-format      | L            | L      | 463,269 | Two review rounds plus one fix. Three change requests.                                       |
| compile-update       | M            | M      | 264,692 | Two review rounds; payload order changed the contract.                                       |
| analyze-v9           | S            | S      | 173,608 | Added handler-mutate alias check on request.                                                 |
| vite-plugin          | L            | L      | 300,374 | Two review rounds; enforce pre was missed at first.                                          |
| e2e-harness          | M            | M      | 182,520 | One review round.                                                                            |
| props-method-path    | S            | S      | 132,199 | Fix node, proven.                                                                            |
| compile-view-codegen | M            | L      | 380,962 | Two review rounds; payload desync with compile-update.                                       |
| patch-bindings       | M            | M      | 292,156 | Two review rounds; row-binding gap.                                                          |
| ssr-render           | M            | M      | 184,442 | One review round.                                                                            |
| compile-integration  | S            | S      | 152,810 | One review round.                                                                            |
| row-list-exports     | S            | S      | 112,157 | Fix node, proven.                                                                            |
| patch-lists          | M            | M      | 248,442 | One review round plus seam swap.                                                             |
| resume-loader        | M            | L      | 344,397 | Two review rounds; size measured unminified at first.                                        |
| chunk-helpers        | M            | M      | 282,253 | One review round.                                                                            |
| testing-mount        | S            | M      | 261,031 | Two workarounds replaced before review.                                                      |
| example-todo         | M            | M      | 227,462 | One review round; goal verified in Chromium.                                                 |
