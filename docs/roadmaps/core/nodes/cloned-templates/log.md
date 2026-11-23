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

### Review fixes (after the rebase on `batch/core` fb78915)

- `<template>` with a write falls back; `clone$` checks the mark count; `clone$(template, doc)` with a per-document `WeakMap`; `pre`/`listing` text holes fall back; static-event-only bodies fall back (`isFixedMessage`).
- The example-server fix was dropped. The plugin's dev middleware serves `/@id/idlip/client` as a proxy module that imports `idlip/client`. A `resolveId` hook keyed on "no importer" did not work: Vite resolves the request with the root `index.html` as importer and applies aliases first.
- A dynamic hole never appears in a row or a block (`plan.ts` `bindHole`), so that fallback cannot be hit; the test asserts such a row clones.
- A/B with N = 21 fixed before the runs. Raw output below.

ab-final:

```
load average at the start: 2.99 9.61 9.37
load average at the end: 3.20 5.70 7.60
create1k   base 38.0 (MAD 0.8) | branch 35.4 (MAD 2.0) -6.7% noise 5.9 within noise
replace1k  base 34.3 (MAD 1.5) | branch 32.3 (MAD 1.9) -5.9% noise 5.7 within noise
append1k   base 67.1 (MAD 1.0) | branch 57.2 (MAD 0.8) -14.7% noise 3.0 real
create10k  base 319.8 (MAD 6.4) | branch 250.5 (MAD 3.2) -21.7% noise 19.2 real
{"create1k":{"base":[37.309,36.914,30.286,30.043,30.978,38.472,40.486,38.095,37.441,39.828,37.081,37.215,37.979,38.336,34.011,37.716,40.194,38.19,38.443,40.313,38.632],"branch":[25.426,25.402,36.79,25.368,37.749,35.892,36.063,28.036,33.472,36.398,37.01,35.44,36.416,28.606,29.993,40.129,36.266,37.282,30.366,31.348,35.179]},"replace1k":{"base":[31.413,33.567,34.278,37.699,32.74,35.395,34.124,32.764,39.541,34.229,34.461,34.498,36.196,45.543,33.057,44.265,36.253,32.22,33.315,32.271,38.642],"branch":[34.755,33.911,34.173,28.274,34.547,31.223,37.821,34.188,24.877,30.56,30.503,26.126,31.189,34.21,33.344,32.545,32.535,28.296,29.927,32.258,30.981]},"append1k":{"base":[66.539,67.406,66.618,66.886,65.71,66.056,68.815,68.331,68.478,67.236,49.66,69.671,67.15,67.061,68.551,51.914,78.626,66.577,66.111,69.434,67.07],"branch":[55.393,56.82,58.196,56.979,56.366,57.217,57.738,57.171,55.968,61.889,57.272,54.45,57.602,57.102,59.007,57.21,60.655,59.399,57.997,58.123,57.051]},"create10k":{"base":[315.564,334.074,329.669,316.307,311.82,324.157,326.199,317.01,337.831,342.163,316.287,317.884,319.809,327.753,321.21,319.376,327.117,313.126,320.191,311.493,312.996],"branch":[253.85,253.95,253.668,252.685,250.309,224.271,255.672,250.479,251.786,253.979,230.437,249.961,250.464,232.28,252.36,250.894,248.865,244.437,249.721,228.891,229.088]}}
```

ab-final2:

```
load average at the start: 1.75 2.97 4.83
load average at the end: 32.99 19.97 11.74
create1k   base 38.2 (MAD 1.1) | branch 29.8 (MAD 4.1) -22.2% noise 12.4 within noise
replace1k  base 36.9 (MAD 2.5) | branch 30.3 (MAD 1.4) -17.9% noise 7.4 within noise
append1k   base 72.2 (MAD 5.4) | branch 62.6 (MAD 2.9) -13.4% noise 16.3 within noise
create10k  base 821.4 (MAD 6.1) | branch 578.0 (MAD 6.2) -29.6% noise 18.7 real
{"create1k":{"base":[37.303,42.499,37.252,37.902,38.066,40.02,40.247,38.241,37.21,39.492,39.668,36.686,37.647,39.654,30.552,30.638,39.574,37.174,39.136,39.059,38.658],"branch":[28.771,25.7,25.617,22.731,36.826,34.222,30.571,26.98,27.022,34.52,29.763,35.416,36.212,26.426,24.191,25.375,34.698,33.518,34.994,27.387,30.403]},"replace1k":{"base":[37.079,33.829,34.752,34.796,33.023,33.586,32.666,32.794,37.387,36.895,36.686,34.103,33.599,37.698,38.519,39.299,48.553,39.356,40.063,39.083,45.095],"branch":[33.034,29.896,30.773,30.651,30.279,31.038,31.7,31.136,26.843,30.148,27.71,30.728,29.956,35.238,32.663,28.082,27.31,33.755,28.098,29.744,28.186]},"append1k":{"base":[79.488,59.089,70.021,67.619,59.698,67.266,70.214,72.245,71.56,70.909,73.474,61.331,72.419,77.669,78.289,68.858,77.902,100.521,86.386,88.82,107.612],"branch":[58.017,59.734,61.486,60.996,62.584,61.082,58.112,62.567,61.872,62.691,59.153,59.676,64.53,64.281,66.234,66.313,66.979,73.712,74.253,79.415,83.528]},"create10k":{"base":[821.429,838.029,806.009,817.337,819.733,812.369,861.071,832.579,819.619,827.198,822.698,848.56,824.522,816.892,881.681,791.13,861.379,819.425,824.049,815.279,811.643],"branch":[577.764,569.971,571.19,575.283,580.293,571.767,576.081,589.278,584.69,570.49,592.742,584.995,576.856,578.073,590.185,604.17,621.23,581.289,575.454,577.991,572.099]}}
```
