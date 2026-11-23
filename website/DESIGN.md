# Design language of the website

The site uses the Block direction. The page is a grid of rounded tiles, and the tile that changed is chartreuse. An idlip view is a set of bindings and a click updates only the ones whose model paths changed, so the page is built the same way.

The tokens are CSS custom properties in [`src/styles.css`](./src/styles.css), between the `tokens:start` and `tokens:end` comments, with a light and a dark value for each color. Use a token, never a raw value. The demo frame copies the same block at build time (`src/demo/build.ts`), so keep the markers.

## Color

| Token                           | Use                                                                         |
| ------------------------------- | --------------------------------------------------------------------------- |
| `--bg`                          | The page, and the gaps between tiles.                                       |
| `--bg-elevated`                 | Tiles: the text of a docs page, the sidebar, cards, the demo.               |
| `--surface`, `--surface-strong` | Wells inside a tile, table stripes, hover fills, inline code.               |
| `--text`                        | Body text and headings.                                                     |
| `--muted`                       | Secondary text. Reaches 4.5:1 on `--bg`, `--bg-elevated` and `--surface`.   |
| `--subtle`                      | Decorative marks only. Never text.                                          |
| `--border-strong`               | The edge of a swatch or a hovered field. Tiles have no borders.             |
| `--ink`, `--on-ink`             | The ink tile (the hero, the step text) and its text. Light in dark mode.    |
| `--on-ink-muted`                | Secondary text on an ink tile.                                              |
| `--accent-fill`, `--on-accent`  | Chartreuse: what changed, the current item, the primary button. Ink text.   |
| `--accent-strong`               | Accent as text or a line on a light tile: link underlines, the best value.  |
| `--accent-tint`                 | A wash behind a done todo in the demo.                                      |
| `--focus`                       | The focus ring. Olive in light mode, since chartreuse on white is too pale. |
| `--danger`                      | A loss in the benchmark table, and errors.                                  |
| `--code-bg`, `--syn-*`          | Code blocks and the highlighter token colors.                               |

Chartreuse means "this changed" or "this is current". It is never the only sign: a lit step tab also turns ink, a lit request row is also new in the list, a verdict has an icon and a word.

## Contrast

WCAG 2 ratios of the solid token values. Every text pair is at least 4.5:1 in both themes.

| Text              | On                 | Light | Dark |
| ----------------- | ------------------ | ----- | ---- |
| `--text`          | `--bg`             | 15.7  | 17.9 |
| `--text`          | `--bg-elevated`    | 18.7  | 16.2 |
| `--text`          | `--surface-strong` | 14.5  | 12.8 |
| `--muted`         | `--bg`             | 6.2   | 8.3  |
| `--muted`         | `--bg-elevated`    | 7.4   | 7.5  |
| `--muted`         | `--surface`        | 6.7   | 6.8  |
| `--muted`         | `--surface-strong` | 5.7   | 5.9  |
| `--muted`         | `--accent-tint`    | 6.7   | 5.1  |
| `--on-accent`     | `--accent-fill`    | 14.3  | 16.2 |
| `--on-ink`        | `--ink`            | 17.0  | 16.7 |
| `--on-ink-muted`  | `--ink`            | 9.1   | 7.9  |
| `--ink`           | `--on-ink-muted`   | 9.1   | 7.9  |
| `--accent-strong` | `--bg-elevated`    | 7.2   | 15.6 |
| `--danger`        | `--surface`        | 6.0   | 7.2  |
| `--syn-comment`   | `--surface`        | 5.8   | 5.1  |

The other `--syn-*` colors are 5.9 or more on `--surface` and `--code-bg`. `--accent-tint` is measured over `--bg-elevated`.

## Type

- `--font` is Bricolage Grotesque, `--mono` is Martian Mono. Both are OFL and self-hosted from `public/fonts/` as variable `woff2` files (latin subset, from the `@fontsource-variable` 5.3.0 packages). The license files sit next to them.
- Sources: Bricolage Grotesque by Mathieu Triay, [github.com/ateliertriay/bricolage](https://github.com/ateliertriay/bricolage). Martian Mono by Evil Martians, [github.com/evilmartians/mono](https://github.com/evilmartians/mono).
- Headings are weight 800 and tight: -0.05em at display size, -0.035em at `--text-2xl`. Card and step titles are 600.
- Sizes, names of files and numbers that are measured are mono. Numbers that change use `tabular-nums`.

## Shape and motion

- Tiles are `--radius-lg` (28px) with `--gap` (12px) between them. Wells inside a tile are `--radius-md` (20px), small rows `--radius-row` or `--radius-sm`. Buttons, tabs and navigation are pills (`--radius`).
- No borders and no shadows. Spacing and the tile color separate things.
- `--duration-fast` (120ms) for hover and press, `--duration` (220ms) for a state change. Press scales to 0.96, hover lifts 2px.
- The resume diagram moves only by CSS transitions of `data-step`, so every change reverses from where it is. The counters count from the shown value, so a reversed step counts back.
- With `prefers-reduced-motion: reduce` every transition ends at once, the stepper is hidden, and the four steps show as static panels.

## Layout

- Content is at most `--page-width` (84rem) wide.
- The landing page is a 12-column grid: the hero, the resume diagram, the demo, the feature grid, the benchmarks and the todo sample.
- A docs page has three columns: the sidebar, the text and the table of contents. Below 70rem the table of contents is hidden. Below 48rem the sidebar sits above the text.
- The header is `--header-height` tall and sticky. `.header-slot` between the brand and the navigation is empty: `website-search` puts its search bar there. `HEADER_LINKS` in `src/layout.ts` lists the navigation links, where `website-repl` adds its link.

## Scripts

`src/client.ts` imports every file in `src/client/` and adds nothing itself. A feature is one file there: `theme.ts`, `copy.ts`, `resume.ts`, `demo.ts`. Shared code goes in `src/client/lib/`, which the import skips. `lib/network.ts` is the network panel of a frame, for the demo and the REPL.

## States

- Every control has the `:focus-visible` ring: 3px of `--focus`, 2px away.
- The current page has `aria-current="page"` and the chartreuse fill. The current step has `aria-current="step"`.
- Icon-only buttons have an `aria-label` and a `title`. Icons are one set: 24px grid, 1.8px stroke.
- The copy button shows `Copied` on chartreuse for 1.5 seconds, or `Failed`.
- The theme follows the system until the toggle is used, then the choice is saved in `localStorage`. The demo frame follows the page's theme.
