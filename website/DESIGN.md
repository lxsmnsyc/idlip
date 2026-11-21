# Design language of the website

The tokens are CSS custom properties in [`src/styles.css`](./src/styles.css), with a light and a dark value for each color. Use a token, never a raw value, so both themes and later changes reach the page. The tokens come from the brumate website.

## Idea

The site shows what idlip claims: the server renders, the browser resumes, and a click loads only what changed. Motion explains a change of state. It never decorates.

## Color

| Token                             | Use                                                                  |
| --------------------------------- | -------------------------------------------------------------------- |
| `--bg`                            | The page.                                                            |
| `--bg-elevated`                   | Cards, code controls, the pager: what sits on top.                   |
| `--surface`, `--surface-strong`   | Wells, table heads, hover fills, inline code.                        |
| `--text`                          | Body text, headings, the fill of a primary button.                   |
| `--muted`                         | Secondary text. Reaches 4.5:1 on `--bg`.                             |
| `--subtle`                        | Rules and icons that repeat a label. Never the only text of a thing. |
| `--border`, `--border-strong`     | Lines between parts, and the edge of a control.                      |
| `--accent`                        | Focus rings, large marks, the accent word of the display heading.    |
| `--accent-strong`                 | Accent text: links, eyebrows, the current sidebar item.              |
| `--accent-tint`                   | A wash behind text: the current sidebar item, a selection.           |
| `--cool`, `--cool-tint`           | The second color: what updates, as against what ships code.          |
| `--danger`, `--warn`, `--success` | Errors, warnings and passing checks only.                            |
| `--code-bg`                       | Code blocks. Syntax colors come from `@twinkleplop/theme-github`.    |

Orange means "code ships or runs here". Blue means "this value updates".

## Type

- `--font` is Inter Tight and `--mono` is JetBrains Mono. Neither is bundled: the stacks fall back to system fonts.
- `--text-xs` to `--text-xl` are fixed steps. `--text-2xl` and `--text-display` are fluid.
- Headings are weight 600 with negative letter spacing: -0.045em at display size, -0.035em at `--text-2xl`, -0.02em below.
- One word of the display heading takes the accent color, in `<em>`.

## Shape and motion

- Radii: `--radius-sm` for inline code and small controls, `--radius` for buttons, `--radius-lg` for code blocks.
- Shadows mean "above the page": a hovered button or pager link. A part in the flow has none.
- `--duration-fast` (120ms) for hover and press, `--duration` (200ms) for a state change, `--ease` everywhere.
- A button rises 1px on hover and presses to 0.98. An arrow moves 3px.
- With `prefers-reduced-motion: reduce`, every transition ends at once.

## Layout

- Content is at most `--page-width` (76rem) wide with 1.5rem of side padding.
- A docs page has three columns: the sidebar, the text (46rem at most) and the table of contents. Below 70rem the table of contents is hidden. Below 48rem the sidebar sits above the text.
- The header is `--header-height` tall and sticky.

## States

- Every control has the `:focus-visible` ring: 2px of `--accent`, 2px away.
- The current page has `aria-current="page"` and the accent tint.
- Code blocks that scroll take focus and have a name. The copy button shows `Copied` for 1.5 seconds.
- The theme follows the system until the toggle is used, then the choice is saved in `localStorage`.
