# Log: fix-string-length

- Reproduced: unit test `string-length.test.ts` and differential subject `string-length` failed on the base.
- Cause: `readField` returned `undefined` for any non-record, so `label.length` read `undefined` on both sides and `checkChanged` saw no change.
- Fix: `readField` reads `length` of a string. Arrays and records already worked. A string has no other field a hole reads.
- Loader cost: `gzip -9` of the todo loader file 4062 B before, 4082 B after (+20 B). The e2e `loaderBudget` (loader plus static imports) passes.
- The e2e suite failed one different test on two runs while another worker ran at the same time, and passed alone on the third.
