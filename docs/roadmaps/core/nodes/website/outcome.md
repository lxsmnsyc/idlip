# Outcome: website

## Result

The worker part is done. The gate stays open: the user deploys and confirms.

- `website/vercel.json`: deploys only `main`, skips a build when `website`, `packages`, `examples`, the lockfile or the workspace files did not change, builds the workspace dependencies and then the site, serves `dist/client` with clean URLs.
- No COOP or COEP header. The REPL compiles with the WebAssembly build of oxc-parser, which uses a shared `WebAssembly.Memory`, but it runs in a plain static server with no isolation headers (checked with Playwright, see below). The run frames are sandboxed with `allow-scripts` and no `allow-same-origin`, which COEP would not help.
- Header rules:
  - `/assets/` files with a content hash in the name (`name-<8 chars>.js`, `.css`, `.wasm`) and everything under `/demo/assets/` except `build.js`: `public, max-age=31536000, immutable`.
  - `build.js` in any folder: `Cache-Control: no-store`. The immutable rules do not match it. The site's own build writes none (`skew: false` for the demo), the rule is for a deployed idlip app.
  - `/fonts/(.*)`: `Access-Control-Allow-Origin: *`, because the sandboxed REPL and edited-sample frames have the origin `null` and a font request is cross-origin.
- Not what the brief copied from brumate: the brumate rule `/assets/(.*)` as immutable would also cover `assets/site.js`, `site.css`, `site2.css` and `site.wasm`. The site build names those without a hash, so a year of caching would serve the old site after a deploy. They keep Vercel's default revalidation.
- `ignoreCommand` also watches `examples`, because the landing demo builds `examples/todo`.

## Fonts in the REPL frame

- `website/vite.config.ts` has a `website:font-cors` plugin: dev and `vite preview` send `Access-Control-Allow-Origin: *` for `/fonts/`. Vite's own CORS setting allows localhost origins only.
- Playwright (headless Chromium) on `vite preview`: the REPL frame (origin `null`, `about:srcdoc`) shows `Bricolage Grotesque:loaded`, and so does a live sample after an edit. Without the header (a plain static server) both show `Bricolage Grotesque:error` and the console reports the CORS block. Static live-sample frames are same-origin and load the font either way.

## Resuming page numbers

- `website/docs/resuming.md` has no typed byte counts. `{{demo.<file>.<raw|gzip>}}` placeholders are filled from `dist/demo-server/demo.json` by `website/src/placeholders.ts`, called from `loadPages`. Files: `document`, `listener`, `loader`, `handler`, `helpers`, `binding`. Totals: `demo.load` (document and loader), `demo.click` (the three first-click files). An unknown name, or a name that starts with `demo.` and is not listed, fails the build. Braces that do not start with `demo.` (JSX objects in samples) stay text. Without a demo build the sizes read `n/a`.
- What is measured: raw is the byte length of the built file or document, gzip is `gzip -9` of the same bytes (`measure()` in `src/demo/build.ts`). The old table was stale and inconsistent (the toggle chunk showed 118 B raw and 119 B gzip). Two details of the measurement:
  - The document is the todo example's own response, before the demo build adds the frame styles and tokens inline. It is not the size of `demo/index.html`.
  - The listener is the text between its `<script>` tags, which the page now says.
- The totals are sums of the per-file gzip sizes, not gzip of the joined bytes. Each file is its own response.

## Share image

- `website/scripts/og.ts` draws `website/public/og.png` (1200 x 630) with headless Chromium from the `e2e` package's Playwright. It reads the headline and the first lead sentence from `src/landing/index.ts`, the colors from the tokens of `src/styles.css` and the fonts from `public/fonts/`. It replaces the hand-made `nodes/perf-from-bench/og.html`. Run `node scripts/og.ts` in `website/` after the hero text changes.
- The image is three tiles in the Block direction: the ink tile with the mark, the headline and the lead, a chartreuse tile with the mark, and a dark tile with `npm i idlip`. The headline reads "Only the code you click loads."
- `og:image:alt` in `src/layout.ts` described a chart the image no longer shows. It now reads the headline and the lead.

## Checks run

- `pnpm --filter website build`, `typecheck`, `pnpm lint` and `pnpm format:check` pass.
- A clean `git archive` export with `pnpm install --frozen-lockfile` runs the `buildCommand` and writes 32 pages.
- `pnpm --filter website test` (2 failures) and `check:samples` (3 problems) fail the same way on main at 9473f96. `fix-website-checks` fixes them.
- Each `vercel.json` header source was run through path-to-regexp 6.1.0 against every file of `dist/client`.

## Not done

- `vercel` was not run, nothing was pushed, no workflow was triggered. The `vercel.json` header sources are checked as regular expressions against the built file names, not by Vercel.

## Deploy steps for the user

1. In `website/`, run `vercel link`. Set the root directory to `website` and the framework preset to Other. Do not copy a token or project id into the repo.
2. Connect the GitHub repository. Set the production branch to `main`.
3. Deploy. The build command in `vercel.json` builds `idlip`, then the site.
4. Attach a domain if wanted.
5. Open the deployment and confirm:
   - the sidebar on a docs page,
   - a code block (highlighting and the Copy button),
   - the benchmark table at `/docs/benchmarks/`,
   - a 404 page,
   - the REPL at `/repl/`: the page inside the frame uses Bricolage Grotesque, and a live sample on a docs page does too after you edit its code.
6. Check `curl -I https://<domain>/fonts/bricolage-grotesque.woff2` shows `access-control-allow-origin: *`, and `curl -I https://<domain>/assets/site.js` does not show `immutable`.
