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
