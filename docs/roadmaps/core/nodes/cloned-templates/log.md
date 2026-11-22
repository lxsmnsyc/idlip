# Log: cloned-templates

## 2026-11-22

- Branch `node/cloned-templates` from `batch/core` 25f491a.
- Read brumate `4b5e93a3` (`codegen/template.ts`, `runtime/client.ts`). Brumate reads its template from the HTML parts after the fact (a character reader). idlip builds the template from the view nodes instead, so no HTML reader is needed.

### Design

- The clone holds the same nodes the HTML parses to, row markers and `<!--t-->` markers included. Server rows and cloned rows look the same to `patchRow`, `readRows`, `findNode` and the differential comparison, so the normalization did not change.
- Template HTML: `i-x="<n>"` on an element that gets a write, `<!--x<n>-->` where a text hole goes. `clone$` parses the template once per chunk and document (through `parseHtml`, so the Trusted Types policy holds), swaps each `<!--x<n>-->` for a text node, and stores the child-index path of each mark. Per row: `document.importNode(content, true)` (no adoption on insert), walk the paths, write.
- Writes: `putAttr$` (as `attr$` writes the attribute, `value`/`checked` included), `putText$` (removes the node for an empty text, as the HTML has none), `setOn$` for event messages that read values. Static event messages stay in the template.
- Kept out (HTML as before): children, nested lists and conditions, `<Try>`, `<Subscribe>`, `<Head>`, global listeners, raw HTML, dynamic holes, holes in `script`/`style`/`textarea`/`title`, text holes directly under table elements or `select`, SVG and MathML bodies, empty bodies, and bodies with no write (the copied `clone$` costs more bytes than the parse of a static body).
- `patchList`: a fragment from `render` is inserted as is and not walked by `findInnerBlocks`, since a cloned row holds no blocks. `setBranch$` takes a string or a node.
- Test harness: `test/vite/features.test.ts` and `test/client/dom/features.test.ts` build with `client: src/client/index.ts` and an empty `resolve`, so a list chunk's `idlip/client` import was external and the shared-chunk check failed. Both alias `idlip/client` to the loader source now. A real app imports `idlip/client` from its loader.

### Profiles

`node benchmarks/harness/profile-rows.mjs idlip <op> 10`, unminified rows builds (`.ab/base-unmin`, `.ab/branch-unmin` copied into `benchmarks/idlip/rows/dist`), load average 2.6 to 3.0. Script and native work a round, ms:

| Op      | base | branch |
| ------- | ---- | ------ |
| create  | 15.0 | 7.2    |
| replace | 19.1 | 16.0   |
| append  | 22.2 | 16.1   |

Base create: `parseHtml` 7.28, `before` 1.55, GC 1.56, `collectBlocks` 0.88, `createHTML` 0.73, `isComment` 0.70, `render` 0.61, `patchList` 0.30.
Branch create: `importNode` 1.47, `setAttribute` 1.20, `clone$` 1.09, `before` 0.96, GC 0.78, `putText$` 0.26, `patchList` 0.19, `render` 0.16, `setOn$` 0.14.
Branch replace: `remove` 3.10 (removing 1,000 old rows node by node), GC 1.66, `importNode` 1.65, `setAttribute` 1.09, `before` 1.07, `clone$` 0.97, `collectBlocks` 0.63 and `isComment` 0.62 (both from `removeRange`), `readRows` 0.40.
Branch append: GC 2.23, `setAttribute` 2.19 (includes the kept-row class binding), `importNode` 1.35, `walk` 1.09, `findNodes` 0.68, `patchRow` 0.31 (the kept-row pass), `clone$` 0.77.
`query :5815` and `(anonymous) :5813` are the harness's `waitForFunction`, about 2 ms in every op on both sides.

"(program)" is 23 to 33 ms in every profile on both sides: style, layout and paint, which this change does not touch.

### After the first A/B

- Hot e2e failed: the remount patched the old body. Cause: the example dev pages load `/@id/idlip/client`, the list chunk's `parseHtml` import resolves to `/@fs/.../dist/client/index.js`, and the browser ran both, so a second loader resumed the page. Fixed in the examples (separate commit). Forcing `canClone` to false made the test pass, which pointed at the new import.
- `clone$` computes each path as it finds the mark (no second loop): rows list chunk 0.92 to 0.89 kB gzip.
- `patchList` finds the blocks of a parsed row before insertion, and none for a clone: loader 4004 to 4033 B (the first form was +31 B).
- Final A/B and profile in `outcome.md`. Raw samples below (ab1 is the earlier build, ab2 to ab4 the final one).

### Raw A/B output

ab1:

```
create1k   base 29.4 (MAD 0.3) | branch 23.7 (MAD 0.2) -19.2% noise 1.0 real
replace1k  base 32.9 (MAD 0.3) | branch 28.9 (MAD 1.0) -12.2% noise 3.1 real
append1k   base 60.2 (MAD 2.7) | branch 54.8 (MAD 0.1) -9.0% noise 8.0 within noise
create10k  base 376.3 (MAD 60.8) | branch 290.3 (MAD 40.7) -22.8% noise 182.5 within noise
{"create1k":{"base":[29.396,28.909,29.454,28.726,30.947,29.591,31.418,29.06,29.21],"branch":[23.839,23.244,23.874,23.325,23.581,23.853,23.563,25.46,23.739]},"replace1k":{"base":[36.703,33.016,33.048,32.899,32.399,32.488,32.573,32.888,34.544],"branch":[28.506,30.368,27.847,30.009,28.896,28.058,29.407,31.092,27.645]},"append1k":{"base":[77.355,65.537,68.214,64.006,58.581,58,58.509,60.233,57.563],"branch":[56.765,54.816,56.979,54.685,54.017,55.03,54.695,54.816,54.902]},"create10k":{"base":[315.437,328.84,376.28,346.393,579.814,1159.096,824.002,585.24,336.554],"branch":[249.663,244.479,228.463,290.336,308.833,690.296,784.552,311.486,262.135]}}
```

ab2:

```
create1k   base 28.9 (MAD 0.5) | branch 23.5 (MAD 0.3) -18.7% noise 1.4 real
replace1k  base 33.3 (MAD 0.3) | branch 31.1 (MAD 1.4) -6.7% noise 4.1 within noise
append1k   base 59.9 (MAD 2.6) | branch 56.1 (MAD 1.2) -6.3% noise 7.9 within noise
create10k  base 317.6 (MAD 3.2) | branch 247.3 (MAD 4.8) -22.1% noise 14.5 real
{"create1k":{"base":[29.519,28.431,29.373,29.003,28.771,28.849,28.885,29.35,28.759,29.433,28.398],"branch":[24.944,23.81,23.475,23.239,25.779,23.591,23.233,24.954,23.339,23.075,23.026]},"replace1k":{"base":[33.572,33.083,33.315,34.473,33.276,33.161,32.903,35.204,32.425,36.309,33.467],"branch":[27.19,27.33,26.598,31.091,33.201,32.871,30.627,32.444,31.554,31.309,30.428]},"append1k":{"base":[67.627,65.703,59.108,66.74,66.861,66.494,59.935,59.075,57.309,58.986,59.375],"branch":[56.637,57.142,58.898,57.169,58.62,54.387,54.619,55.356,56.149,54.946,53.851]},"create10k":{"base":[324.929,323.543,321.993,313.749,314.437,314.558,317.581,319.651,326.259,314.389,316.437],"branch":[240.993,248.252,242.349,247.31,254.102,248.139,238.328,252.134,239.876,242.986,250.831]}}
```

ab3:

```
replace1k  base 34.0 (MAD 0.3) | branch 29.0 (MAD 1.3) -14.5% noise 3.8 real
append1k   base 60.0 (MAD 1.5) | branch 55.8 (MAD 1.2) -7.0% noise 4.6 within noise
{"replace1k":{"base":[31.914,37.072,34.05,37.463,33.905,37.252,33.692,33.632,33.909,37.039,34.016,34.372,36.138,35.512,33.816,33.913,33.641,33.693,34.896,33.789,33.964],"branch":[29.714,32.924,34.812,26.546,31.363,32.821,29.822,33.991,28.401,29.036,30.402,27.417,27.913,27.729,28.082,28.864,28.022,30.26,29.328,27.774,27.112]},"append1k":{"base":[60.034,59.415,59.191,59.984,70.955,66.497,66.169,66.559,79.095,58.897,59.413,58.763,58.506,60.805,57.806,61.058,59.851,57.202,68.405,69.517,64.877],"branch":[55.392,54.098,55.626,56.18,55.825,56.995,58.722,56.676,59.471,52.753,54.603,54.663,55.897,54.248,54.928,55.339,56.134,55.342,60.947,59.403,58.312]}}
```

ab4:

```
append1k   base 59.6 (MAD 1.2) | branch 55.9 (MAD 1.0) -6.2% noise 3.6 real
{"append1k":{"base":[66.228,66.039,65.144,60.522,58.781,60.07,62.04,59.921,58.378,59.105,57.959,60.087,55.361,48.872,66.589,66.379,66.502,69.018,56.663,60.704,58.592,60.07,56.573,59.385,58.886,58.592,59.41,58.83,60.919,57.203,59.587],"branch":[56.531,55.116,57.036,56.221,55.899,55.791,54.866,55.058,54.588,57.549,55.883,55.656,58.726,57.343,56.066,52.869,57.368,59.732,59.825,54.837,54.552,56.02,56.211,54.684,54.611,56.668,55.862,54.465,56.396,54.645,54.822]}}
```
