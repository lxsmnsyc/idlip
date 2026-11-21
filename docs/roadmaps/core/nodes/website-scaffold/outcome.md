# Outcome: website-scaffold

## Built

`website/` (workspace package `website`, private). A static site: Markdown in `website/docs/` becomes one page each. It does not run on idlip.

Files: `package.json`, `tsconfig.json`, `vite.config.ts`, `DESIGN.md`, `README.md`, `src/` (`front-matter.ts`, `markdown.ts`, `samples.ts`, `site.ts`, `layout.ts`, `client.ts`, `styles.css`), `scripts/build.ts`, `scripts/check-samples.ts`, `test/site.test.ts`, `docs/index.md` (placeholder).

### For page nodes: add a file under `website/docs/`

Front matter is required, between `---` lines at the top:

| Field         | Required | Meaning                                                              |
| ------------- | -------- | -------------------------------------------------------------------- |
| `title`       | yes      | The `h1`, the sidebar entry and the tab title.                       |
| `order`       | yes      | A number. Pages sort by it inside a section.                         |
| `section`     | yes      | The sidebar group. Sections sort by the lowest `order` they contain. |
| `description` | no       | Link preview text. The first paragraph is used without it.           |

A missing field fails the build. A value in double quotes is read as JSON (use it for a title with `:`).

- Start the body at `##`: the title is already the `h1`.
- `docs/index.md` is `/docs/`, `docs/a/b.md` is `/docs/a/b/`, subfolders are allowed. The landing page `/` is generated, not a Markdown file.
- Link to another page with a relative `.md` path, optionally with `#heading`: `[state](./state.md#derived)`. Heading ids follow GitHub's rule.
- No navigation registry to edit. Previous and next links follow the sidebar order.
- `index.md` uses `section: Start`, `order: 0`.

### Fence tags

- `tsx`: compiled by the checker with `compile(source, '/sample.idlip.tsx')`. Any diagnostic (error or warning, such as `let-unassigned`) or thrown error fails it. The block must be a whole module with a default export.
- `tsx fragment`: only the view. The checker wraps it in `export default function Sample() { return ( ... ); }` with `For`, `Try`, `Head`, `Subscribe` imported from `idlip`. It cannot use state, so use it for markup only.
- `tsx no-check`: highlighted, not compiled. For partial code, config, or code that is not a module.
- `ts`, `css`, `bash`, `json`: highlighted only. Other languages render plain.

Highlighting is the stock TSX grammar from `@twinkleplop`; the tag after the language does not change it.

### Commands

- `pnpm --filter website build`: Vite writes `dist/client/assets/site.{js,css}`, then pages are written next to them. `BASE=/prefix/` sets the base path.
- `pnpm --filter website check:samples`: prints `N samples, M problems`, exit 1 on any problem, with `file:line`.
- `pnpm --filter website test`, `typecheck`, `preview`.

`check:samples` and `test` import `idlip/compiler` from `dist`, so run `pnpm --filter idlip build` first (the root `pnpm build` does).

Layout: header with GitHub link and theme toggle (saved in `localStorage`, follows the system until used), sidebar, table of contents (h2 and h3), previous and next links, copy button on code. The landing page states the claim, links the guide and shows `examples/todo/src/todo.idlip.tsx` highlighted (read at build time; omitted if missing).

## Deviations

- `pnpm-workspace.yaml` gained `website` and `pnpm-lock.yaml` changed (shared path, minimal).
- The root `build` and `test` scripts were not changed: they filter to `packages/*` and `examples/*`, so the website is built and tested by its own filter. Root `typecheck` (`pnpm -r`) now includes it.
- No `vitest.config.ts` (not in owned paths); `vite.config.ts` serves both.
- Fonts are not bundled; the font stacks fall back to system fonts. Brumate ships woff2 files, which would be binary assets.
- The test for the failing checker uses a closure in a model value and a spread hole, as the debate override says.
- `docs/index.md` only; the landing page is `src/layout.ts`.

## Stubs left

- `docs/index.md` is a placeholder for the page nodes.
- No `vercel.json`, no search, no live demos (out of scope).

## Gotchas

- The compiler warns on a `let` that is never assigned, and the checker treats warnings as failures. Samples need a handler that assigns it, or `no-check`.
- Fragments cannot declare state or imports beyond the four block components.
- `oxlint` through `pnpm lint` misreports its JSON output in this repo; run `./node_modules/.bin/oxlint --type-aware`.
- Root `oxfmt --check` fails on `docs/roadmaps/core/contracts/markup-grammar.md`, which is not part of this node.

## Proposed learnings

- None.

## Verification

- `pnpm --filter website build`: pass (2 pages).
- `pnpm --filter website test`: pass, 10 tests (page per file, sidebar order, prev/next, link rewrite, front matter errors, checker accepts and rejects).
- `pnpm --filter website check:samples`: pass, 1 sample, 0 problems.
- `pnpm --filter website typecheck`: pass.
- `pnpm test` (root): 659 passed. `oxlint --type-aware website`: clean. `oxfmt --check`: only the markup-grammar file outside this node fails.

## Size

- Estimated M, actual M.
