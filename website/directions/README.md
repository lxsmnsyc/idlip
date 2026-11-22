# Visual directions for the website

Three proposals to replace the brumate look of the scaffold (Inter Tight, the orange `#d4612a` accent, the blue `#2a76b2` second color and the cream `#fbfaf8` page). Pick one and `website-polish` builds it.

Each folder holds:

- `tokens.css`: the `:root` tokens, light and dark, with the same names as `website/src/styles.css` where a token exists there.
- `style.css`: the components of the direction.
- `landing.html`: the landing page. Hero, resume diagram, live demo with a network panel, feature grid, benchmarks with the losses, and the todo sample.
- `docs.html`: the page `website/docs/resuming.md`, rendered by the site's own Markdown renderer.
- Eight screenshots: `<page>-<light|dark>-<1440|390>.png`, full page.

Shared files: `demo.js` (theme toggle, copy buttons, and the demo, which replays the requests measured in `website/docs/resuming.md`) and `syntax.css` (maps highlighter classes to the `--syn-*` tokens).

To view them, serve this folder: `python3 -m http.server 8000`, then open `http://localhost:8000/trace/landing.html`. The mocks load fonts from Google Fonts. All six families are OFL, so the site can self-host them as `woff2`.

The landing screenshots show the demo after one click, so the network panel lists the two chunks of the click.

## Summary

| Direction | Idea                                     | Type pair                                          | Accent, light and dark                        | Shape                                      |
| --------- | ---------------------------------------- | -------------------------------------------------- | --------------------------------------------- | ------------------------------------------ |
| Trace     | The site reads as a request trace.       | IBM Plex Sans, IBM Plex Mono                       | Teal green `#00a07f` / `#2ed8ae`, yellow mark | Square cells on a 1px grid, 2 to 4px radii |
| Folio     | The site reads as a printed manual.      | Newsreader, Public Sans, Spline Sans Mono for code | Crimson `#c2185b` / `#ff6fa3`                 | No radius, ink rules, wide margins         |
| Block     | The page is a set of independent blocks. | Bricolage Grotesque, Martian Mono                  | Chartreuse `#c6f135` / `#d4ff3d`              | 28px tiles, pills, no borders              |

Accent hues: brumate is 19° (orange) and 206° (blue). Trace is 168° with a 50° yellow mark, Folio 336°, Block 74°.

## Trace

The site shows what idlip claims the way a browser's network panel would: as requests, bytes and time. The hero is a request waterfall of `examples/todo`. The document and the loader load, a hatched gap shows the idle time in which no view code runs, then the click loads `handler.toggle.js` and `binding.todos._.done.js` and patches `todos.*.done`. Green marks code that loaded. Yellow, as a highlighter mark, marks a value that changed. Every measured value is set in mono. Sections are rows of one bordered grid, so the page reads as a table of facts.

- **Type**: IBM Plex Sans for text and headings (600, -0.03em at display size), IBM Plex Mono for labels, sizes, navigation and code. Both by IBM, OFL, [github.com/IBM/plex](https://github.com/IBM/plex).
- **Palette**: cool grey page `#f4f5f6` / `#0b0d0f`, white cells, ink `#0d1012`, teal green `#006b55` for text and `#00a07f` for marks, yellow `#ffe45c` behind changed values.
- **Shape**: square cells with 1px borders. The grid lines replace boxes, so there are no shadows and no cards. Corners on controls are 2 to 4px.

| Text              | On              | Light | Dark |
| ----------------- | --------------- | ----- | ---- |
| `--text`          | `--bg`          | 17.5  | 16.1 |
| `--text`          | `--bg-elevated` | 19.1  | 15.1 |
| `--muted`         | `--bg`          | 6.8   | 7.7  |
| `--muted`         | `--bg-elevated` | 7.4   | 7.2  |
| `--muted`         | `--surface`     | 6.3   | 6.8  |
| `--accent-strong` | `--bg`          | 5.9   | 12.1 |
| `--accent-strong` | `--bg-elevated` | 6.5   | 11.4 |
| `--on-accent`     | `--accent-fill` | 6.5   | 10.4 |
| `--danger`        | `--bg-elevated` | 6.5   | 8.1  |
| `--success`       | `--bg-elevated` | 6.5   | 11.4 |
| `--on-mark`       | `--mark`        | 15.0  | 8.8  |
| `--syn-keyword`   | `--code-bg`     | 7.3   | 9.6  |
| `--syn-string`    | `--code-bg`     | 6.7   | 11.9 |
| `--syn-function`  | `--code-bg`     | 7.0   | 10.2 |
| `--syn-tag`       | `--code-bg`     | 6.5   | 11.7 |
| `--syn-attr`      | `--code-bg`     | 6.8   | 11.9 |
| `--syn-type`      | `--code-bg`     | 7.2   | 9.8  |
| `--syn-number`    | `--code-bg`     | 6.8   | 11.9 |
| `--syn-comment`   | `--code-bg`     | 5.9   | 6.0  |
| `--syn-punct`     | `--code-bg`     | 7.4   | 7.4  |

Screenshots: `trace/landing-light-1440.png`, `trace/landing-dark-1440.png`, `trace/landing-light-390.png`, `trace/landing-dark-390.png`, `trace/docs-light-1440.png`, `trace/docs-dark-1440.png`, `trace/docs-light-390.png`, `trace/docs-dark-390.png`.

## Folio

The page arrives complete, the way a printed page does, and only the changed line is inked again. The site is set as a technical manual: a large serif headline, chapters numbered I to V in the margin, figures and a table with numbered captions, and notes beside the code. Black ink rules frame each figure and the benchmark table (rules above, below and under the head only). Crimson is the one ink color. It marks what the click changed: the third step of Figure 1, the two requests in the network log and the italic accent word of the headline.

- **Type**: Newsreader for headings and large numbers (Production Type, OFL, [github.com/productiontype/Newsreader](https://github.com/productiontype/Newsreader)), Public Sans for text (USWDS, OFL, [github.com/uswds/public-sans](https://github.com/uswds/public-sans)), Spline Sans Mono for code (OFL, [github.com/SorkinType/SplineSansMono](https://github.com/SorkinType/SplineSansMono)). Three faces: the mono is for code only.
- **Palette**: white page `#ffffff` / `#141317`, ink `#18171c` for text and rules, crimson `#a3124e` for text and `#c2185b` for marks, green `#1d6b3f` for "ahead" in the benchmark table.
- **Shape**: no radius. Rules, not boxes. The only round things are the step icons and the icon buttons.

| Text              | On              | Light | Dark |
| ----------------- | --------------- | ----- | ---- |
| `--text`          | `--bg`          | 17.8  | 15.6 |
| `--text`          | `--bg-elevated` | 17.8  | 14.6 |
| `--muted`         | `--bg`          | 7.5   | 7.8  |
| `--muted`         | `--bg-elevated` | 7.5   | 7.3  |
| `--muted`         | `--surface`     | 6.8   | 6.7  |
| `--accent-strong` | `--bg`          | 7.6   | 8.7  |
| `--accent-strong` | `--bg-elevated` | 7.6   | 8.1  |
| `--on-accent`     | `--accent-fill` | 7.6   | 7.4  |
| `--danger`        | `--bg-elevated` | 7.6   | 8.1  |
| `--success`       | `--bg-elevated` | 6.5   | 9.9  |
| `--syn-keyword`   | `--code-bg`     | 7.1   | 8.2  |
| `--syn-string`    | `--code-bg`     | 6.1   | 10.8 |
| `--syn-function`  | `--code-bg`     | 7.1   | 8.8  |
| `--syn-tag`       | `--code-bg`     | 7.7   | 9.0  |
| `--syn-attr`      | `--code-bg`     | 6.5   | 10.8 |
| `--syn-type`      | `--code-bg`     | 5.8   | 10.7 |
| `--syn-number`    | `--code-bg`     | 6.5   | 10.8 |
| `--syn-comment`   | `--code-bg`     | 5.9   | 5.7  |
| `--syn-punct`     | `--code-bg`     | 7.0   | 7.4  |

Screenshots: `folio/landing-light-1440.png`, `folio/landing-dark-1440.png`, `folio/landing-light-390.png`, `folio/landing-dark-390.png`, `folio/docs-light-1440.png`, `folio/docs-dark-1440.png`, `folio/docs-light-390.png`, `folio/docs-dark-390.png`.

## Block

An idlip view is a set of bindings, and a click updates only the ones whose model paths changed. The page is built the same way: a 12-column grid of rounded tiles, and the tile that changed is chartreuse. The resume diagram is three tiles with the bytes of each step, and only the third, the click, is lit. In the demo the app and the network panel are two tiles, and the two rows the click loaded turn chartreuse. The hero is an ink tile with the accent word on a chartreuse block. The type is heavy (800) and tight, so the page stays legible at a glance.

- **Type**: Bricolage Grotesque for text and headings (Mathieu Triay, OFL, [github.com/ateliertriay/bricolage](https://github.com/ateliertriay/bricolage)), Martian Mono for code and sizes (Evil Martians, OFL, [github.com/evilmartians/mono](https://github.com/evilmartians/mono)).
- **Palette**: neutral grey page `#ebebee` / `#08080a`, white tiles `#ffffff` / `#161619`, ink tiles `#121214` (light `#f2f2f4` in dark), chartreuse `#c6f135` / `#d4ff3d` as a fill with ink text on it. Accent text on white is olive `#436000`.
- **Shape**: 28px tiles, 12px gaps, pill buttons and navigation. No borders and no shadows: the gaps separate the tiles.

| Text              | On                 | Light | Dark |
| ----------------- | ------------------ | ----- | ---- |
| `--text`          | `--bg`             | 15.7  | 17.9 |
| `--text`          | `--bg-elevated`    | 18.7  | 16.2 |
| `--muted`         | `--bg`             | 6.2   | 8.3  |
| `--muted`         | `--bg-elevated`    | 7.4   | 7.5  |
| `--muted`         | `--surface`        | 6.7   | 6.8  |
| `--accent-strong` | `--bg`             | 6.1   | 17.3 |
| `--accent-strong` | `--bg-elevated`    | 7.2   | 15.6 |
| `--on-accent`     | `--accent-fill`    | 14.3  | 16.2 |
| `--danger`        | `--bg-elevated`    | 6.6   | 8.0  |
| `--success`       | `--bg-elevated`    | 7.2   | 15.6 |
| `--on-ink`        | `--ink`            | 17.0  | 16.7 |
| `--on-ink-muted`  | `--ink`            | 9.1   | 7.9  |
| `--text`          | `--surface`        | 17.0  | 14.7 |
| `--muted`         | `--surface-strong` | 5.7   | 5.9  |
| `--syn-keyword`   | `--code-bg`        | 7.5   | 8.4  |
| `--syn-string`    | `--code-bg`        | 6.6   | 13.5 |
| `--syn-function`  | `--code-bg`        | 7.5   | 9.0  |
| `--syn-tag`       | `--code-bg`        | 7.9   | 9.2  |
| `--syn-attr`      | `--code-bg`        | 7.0   | 11.2 |
| `--syn-type`      | `--code-bg`        | 6.5   | 11.4 |
| `--syn-number`    | `--code-bg`        | 7.0   | 11.2 |
| `--syn-comment`   | `--code-bg`        | 6.3   | 5.6  |
| `--syn-punct`     | `--code-bg`        | 7.4   | 7.5  |

Screenshots: `block/landing-light-1440.png`, `block/landing-dark-1440.png`, `block/landing-light-390.png`, `block/landing-dark-390.png`, `block/docs-light-1440.png`, `block/docs-dark-1440.png`, `block/docs-light-390.png`, `block/docs-dark-390.png`.

## Contrast

The ratios above are WCAG 2 ratios between the solid token values, computed from `tokens.css`. Every text color reaches 4.5:1 on each background it sits on, in both themes. `--subtle` is not listed: it is only used for rules and decorative marks, never for the only text of a thing.

## Content of the mocks

- **Benchmark numbers** come from `benchmarks/README.md` (Apple M2, Chrome 158, 2026-11-21). Five of the eight rows are losses: client JS in `dist` against Marko, requests on the first toggle, the first click at 150 ms RTT, creating 1,000 rows and SSR renders per second.
- **Demo sizes** come from `website/docs/resuming.md`: 1,984 B for the document, 3,901 B for the loader, 119 B and 505 B for the two chunks of the first click (gzip -9).
- **The todo sample** is `examples/todo/src/todo.idlip.tsx` without its first four comment lines.
