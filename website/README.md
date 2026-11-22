# website

The documentation site of idlip. A static build: Markdown files in `docs/` become pages. The site does not run on idlip.

```sh
pnpm --filter website build          # writes dist/client
pnpm --filter website preview        # serves dist/client
pnpm --filter website check:samples  # compiles every tsx block of the docs
pnpm --filter website test
```

Every script imports `idlip`: `build` compiles and renders `examples/todo` for the landing demo, and `check:samples` and `test` import `idlip/compiler`. Run `pnpm --filter idlip build` first.

## Pages

Add a Markdown file under `docs/`. Start with front matter:

```md
---
title: State
order: 10
section: Guide
description: Optional. The first paragraph is used without it.
---
```

`title`, `order` (a number) and `section` are required. The sidebar groups pages by `section`, sorts sections by the lowest `order` in them and pages by `order`. `docs/index.md` is `/docs/`, `docs/a/b.md` is `/docs/a/b/`. Links to other pages are relative `.md` paths. The page title is the `h1`, so start the body at `##`.

## Code blocks

- `tsx`: compiled by `check:samples` with `compile()` from `idlip/compiler` as `sample.tsx`.
- `tsx fragment`: only the view, wrapped in `export default function Sample() { return (...) }` with `For`, `Try`, `Head` and `Subscribe` imported.
- `tsx no-check`: highlighted, not compiled. Use it for partial code, config and code that is not a module.
- `ts`, `css`, `bash`, `json`: highlighted only.

See [DESIGN.md](./DESIGN.md) for the tokens. `vercel.json` is not here; the deployment is set up by hand.
