# Outcome: website-directions

## For the user: pick one

| Direction | Idea                                                                                    | Fonts (all OFL)                                       | Accent, light / dark                                    |
| --------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| Trace     | The site reads as a request trace: a waterfall hero, square cells, mono for every size. | IBM Plex Sans, IBM Plex Mono                          | Teal green `#00a07f` / `#2ed8ae`, yellow mark `#ffe45c` |
| Folio     | The site reads as a printed manual: serif headline, numbered chapters, ink rules.       | Newsreader, Public Sans, Spline Sans Mono (code only) | Crimson `#c2185b` / `#ff6fa3`                           |
| Block     | The page is a grid of rounded tiles, and the tile that changed is lit.                  | Bricolage Grotesque, Martian Mono                     | Chartreuse `#c6f135` / `#d4ff3d`, with ink text on it   |

Screenshots (full page, the landing ones after one click in the demo):

### Trace

- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-af513364d111303fa/website/directions/trace/landing-light-1440.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-af513364d111303fa/website/directions/trace/landing-dark-1440.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-af513364d111303fa/website/directions/trace/landing-light-390.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-af513364d111303fa/website/directions/trace/landing-dark-390.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-af513364d111303fa/website/directions/trace/docs-light-1440.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-af513364d111303fa/website/directions/trace/docs-dark-1440.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-af513364d111303fa/website/directions/trace/docs-light-390.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-af513364d111303fa/website/directions/trace/docs-dark-390.png`

### Folio

- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-af513364d111303fa/website/directions/folio/landing-light-1440.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-af513364d111303fa/website/directions/folio/landing-dark-1440.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-af513364d111303fa/website/directions/folio/landing-light-390.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-af513364d111303fa/website/directions/folio/landing-dark-390.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-af513364d111303fa/website/directions/folio/docs-light-1440.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-af513364d111303fa/website/directions/folio/docs-dark-1440.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-af513364d111303fa/website/directions/folio/docs-light-390.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-af513364d111303fa/website/directions/folio/docs-dark-390.png`

### Block

- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-af513364d111303fa/website/directions/block/landing-light-1440.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-af513364d111303fa/website/directions/block/landing-dark-1440.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-af513364d111303fa/website/directions/block/landing-light-390.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-af513364d111303fa/website/directions/block/landing-dark-390.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-af513364d111303fa/website/directions/block/docs-light-1440.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-af513364d111303fa/website/directions/block/docs-dark-1440.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-af513364d111303fa/website/directions/block/docs-light-390.png`
- `/Users/alexis/Documents/GitHub/idlip/.claude/worktrees/agent-af513364d111303fa/website/directions/block/docs-dark-390.png`

After the merge the same files are under `website/directions/` of the main checkout.

## Built

- `website/directions/README.md`: per direction, the idea and how it ties to the claim, the type pair with font sources, the palette, the contrast ratios and the screenshot paths.
- `website/directions/<trace|folio|block>/`: `tokens.css` (light and dark), `style.css`, `landing.html`, `docs.html` and eight screenshots.
- `website/directions/demo.js`: theme toggle, copy buttons, and the live demo. A first checkbox click adds the two chunk requests of `website/docs/resuming.md` (119 B and 505 B) to the network panel. Later clicks add none. The reload button resets it.
- `website/directions/syntax.css`: maps the `@twinkleplop` token classes to `--syn-*` tokens, so each direction has its own code colors.

Each landing page has the hero, the resume diagram, the live demo frame with a network panel, the feature grid (MVU, resumability, TSX function components, subscriptions, effects, nesting, Vite plugin), eight benchmark rows from `benchmarks/README.md` (three ahead, five behind) and the todo sample. Each `docs.html` is `website/docs/resuming.md` rendered by `website/src/markdown.ts`.

## Acceptance

- Three directions, each with tokens, two mocks and eight screenshots (light and dark of both pages at 1440 and 390 px).
- Every text token reaches 4.5:1 on each background it sits on, in both themes. The lowest is 5.6:1 (Block dark comments on the code panel). `README.md` lists every ratio.
- No brumate accent hue, Inter Tight or cream page. Brumate hues are 19° and 206°. Trace is 168° (yellow mark 50°), Folio 336°, Block 74°. Pages are `#f4f5f6`, `#ffffff` and `#ebebee` in light.
- Only `website/directions/` and this `outcome.md` were added. The scaffold's source is unchanged.

## Deviations

- The mocks load fonts from Google Fonts for preview. All six families are OFL and can be self-hosted as `woff2` by `website-polish`.
- The HTML files are generated output (highlighted code and the docs page come from `website/src/markdown.ts`). The generator was a one-off script and is not committed. Edit the HTML directly.

## Stubs left

- The demo replays recorded sizes. It does not run idlip.
- Sidebar and pager links in `docs.html` all point to `docs.html`.

## Gotchas

- An element with `position: absolute` inside a scrolling table container widens the page on mobile unless the container is positioned. The mocks avoid it by not using a visually hidden header cell.

## Proposed learnings

- None.

## Verification

- Screenshots taken with Playwright (chromium) against `python3 -m http.server` on port 48731. At 390 px, `document.documentElement.scrollWidth` is 390 on all six pages.
- Contrast computed from `tokens.css` with the WCAG 2 formula. 0 pairs under 4.5:1.
- `pnpm format:check`: pass (655 files).

## Size

- Estimated S, actual M (three distinct page designs and 24 screenshots).
