# Outcome: website-search

## For the user

The header has a Search button. It opens a command bar on a click, on `/` (outside a text field) and on Cmd or Ctrl+K. The bar finds guide and reference pages by title, heading and text, and Enter jumps to the heading.

- Ranking: a page title beats a heading, and a heading beats text. Every word must match. A word that starts with the term beats a word that shares its stem or a 5-letter prefix ("resume" finds Resuming, "deployment" finds Deploying), and that beats a match in the middle of a word. In text, a term that appears more often breaks a tie. A page shows at most three results.
- The screen reader announces "N results for <query>", and nothing for an empty query.
- Keys: arrows move, Enter opens, Escape closes and focus returns to the Search button. The bar is a native modal `<dialog>` with a label, so the browser traps focus and makes the page behind it inert.
- Empty state: "No results for “…”" with a "Read the guide" link.
- Commands: "Switch the theme", and "Open the REPL" when the header has a link whose address holds `repl`. `website-repl` only needs to add its header link. A command that matches the query comes before the pages.
- Searching "subscription", "effect" and "deploy" lists Subscriptions, Effects and Deploying first (checked in Chromium, and in `test/search.test.ts`).

Screenshots of the open bar with a query (light and dark, 1280 and 390 px wide), in `docs/roadmaps/core/nodes/website-search/`:

- `search-light-1280.png`, `search-dark-1280.png`
- `search-light-390.png`, `search-dark-390.png`

## Built

- `website/src/search/index.ts`: build step. One entry per heading plus one per page (the text before the first heading), with markup, copy buttons and anchors removed. `writeSite` in `src/site.ts` writes it to `search-index.json`, in sidebar order.
- `website/src/search/rank.ts`: matching and ranking, shared by the bar and the tests.
- `website/src/search/palette.ts`: the command bar, plain DOM. `website/src/search/icons.ts`, `entry.ts`: icons and the entry type.
- `website/src/client/search.ts`: the only eager part. It binds the button and the keys, and imports `palette.ts` on the first open. The index is fetched on the first open too.
- Shared files, small edits: `layout.ts` (the button in `.header-slot`), `site.ts` (writes the index), `styles.css` (search section at the end). `client.ts` and `vite.config.ts` are unchanged.
- `website/test/search.test.ts`: an entry per heading of every page, markup removal, ranking (title first for the three acceptance queries), the three-per-page cap, the empty state.

## Sizes

- `search-index.json`: 108,700 B raw, 31,575 B gzip (246 entries, 27 pages). Code blocks are not indexed, inline code is. Loaded on first open only.
- `palette` chunk: 7,700 B raw, 3,304 B gzip. Loaded on first open only.
- `site2.css`, the command bar styles (`src/search/palette.css`, imported by `palette.ts`): 3,122 B raw, 1,002 B gzip. Vite loads it with the chunk on first open.
- Always loaded, added by this node: the bootstrap in `site.js` (about 1 kB) and the button markup and trigger CSS in `site.css`.
- Checked in Chromium: before the bar opens there is no request for the chunk or the index. Opening it requests both.

## Acceptance

- Focus stays inside the dialog after six Tab presses, and returns to the Search button on Escape.
- At 390 px, `scrollWidth` is 390 in light and dark. The button shrinks to an icon.
- `pnpm --filter website build && pnpm --filter website test`: pass (31 tests). `pnpm --filter website check:samples`: 47 samples, 0 problems. `pnpm format:check`: pass. `rtk proxy pnpm lint`: no website findings (the warnings that remain are in `packages/idlip`). `pnpm --filter website typecheck`: pass.

## Deviations

- The index is written by `writeSite`, not by a Vite plugin, since the site renders its pages there. The brief says a build step; this is one.
- Results are one flat list with no group labels. A command is told apart by its icon.
- The REPL command is found from the header link at open time, since `website-repl` had not landed.

## Stubs left

- None. `website/DESIGN.md` does not describe the command bar; it is outside the owned paths.

## Gotchas

- Lint here forbids `void`, `import()` types, and promise-returning functions that are not `async`. Floating promises end in `.catch(reportError)`.
- The decoded text of code blocks can hold `<ul>` and similar, so a test must not treat `<` in index text as leftover markup.

## Proposed learnings

- None.

## Verification

- Playwright (chromium from the `e2e` package) against `vite preview` on port 48977, started and stopped by the script by PID.

## Size

- Estimated M, actual M.
