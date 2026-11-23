# website

The documentation site of idlip. A static build: Markdown files in `docs/` become pages. The site does not run on idlip.

```sh
pnpm --filter website build          # writes dist/client
pnpm --filter website preview        # serves dist/client
pnpm --filter website check:samples  # compiles every tsx block, renders the live ones
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

## Live samples

A `tsx live` fence is a sample the reader can run and edit in the page:

````md
```tsx live
export default function Counter(props: { start: number }) {
  let count = props.start;
  function increment() {
    count = count + 1;
  }
  return <button on:click={increment}>{count}</button>;
}
```

```json live props.json
{ "start": 0 }
```
````

- **Files.** The first fence is the page the sample renders. Its file is named after the default export (`TodoApp` gives `todo-app.tsx`), or `app.tsx`. `tsx live name.tsx` sets the name.
- **More files.** A fence right after it with a name is one more file of the sample: `tsx live part.tsx` for a child, `json live props.json` for the props. Blank lines between them are fine.
- **Checks.** The build compiles each sample and fails on an error. `check:samples` also renders each one on the server side.
- **Static frame.** The build writes `dist/client/live/<page>-<n>/` for each sample: the server render as a page, its chunks, and the Compiled tab. A reader who never edits loads that page, the loader and the chunks of their clicks. No compiler and no service worker.
- **Edits.** The editor loads on the first focus or key in the code. The compiler, the render worker and the service worker load with the first edit. The edit then runs as in the REPL.
- **Code from the address.** A docs page never runs code from its URL or hash. A sample runs the code the build put in the page, or the reader's own edits. Its REPL button opens a sample of one file by id (`#sample=`), which runs. An edited sample, or one of several files, opens with its files in the hash (`#files=`), where the REPL waits for Run.

## Figures

A `figure` fence with a name and no body is an animated figure:

````md
```figure mvu-loop

```
````

- **Names.** `mvu-loop` (the MVU loop, on `components.md`) and `message-trace` (one click from its message to the row, on `resuming.md`). `src/figures/names.ts` lists them. An unknown name or a body fails the build with `docs/<page>.md:<line>: <reason>`.
- **Numbers.** Names, sizes, todos and paths come from the demo build (`DemoData`), as on the landing page.
- **Static.** The build writes the last step of the story. That is what shows without JS and with reduced motion. The search index keeps only the caption.
- **Script.** `src/client/figures.ts` imports `src/figures/player.ts` when the first figure is 400 px from the viewport. The story plays when 40% of the figure shows, pauses off screen and in a hidden tab, and stops at the last step. The replay button starts it again. The row's checkbox takes clicks and keys.

See [DESIGN.md](./DESIGN.md) for the tokens. `vercel.json` is not here; the deployment is set up by hand.
