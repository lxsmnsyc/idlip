# Outcome: component-styles

## Public API

There is no new function, option or export. What users write in entries and config does not change. Two things a user can see:

1. `RenderResult.styles` is a new field of the object that `render()` returns (and `renderPage`). Only a host that writes its own head reads it.

```ts
import { render, renderPreload } from 'idlip/server';

const page = await render(App, props);
page.styles; // ['/assets/todo-CuAi6Ak9.css']
```

2. `csp: true` now writes `style-src 'self' 'nonce-<nonce>'`. A `style-src` in `csp.extend` replaces it, so an existing `extend: { 'style-src': ["'self'"] }` keeps its meaning.

```ts
renderToResponse(App, props, { csp: true });
// content-security-policy: default-src 'none'; script-src 'nonce-…' 'strict-dynamic'; style-src 'self' 'nonce-…'; …
```

Internal, not for users: the `styles` key of the chunk map (`STYLES_KEY` in `server/styles.ts`). Change request `contracts/core-api-component-styles.change-request.md`.

What a user writes to style a component is plain Vite:

```tsx
import './todo.css';
import styles from './todo.module.css';

<p class={left === 0 ? styles.clear : styles.left}>{left} left</p>;
```

## Built

- `packages/idlip/src/vite/styles.ts`, `plugin.ts`: the import walk (`findStyles`), one client entry per module file that makes Vite write the stylesheets, the `styles:<file>` keys of the chunk map, and per-chunk copies of a CSS Module's class object (`\0idlip-names:`).
- `packages/idlip/src/server/styles.ts` (`STYLES_KEY`, `readStyles`, `renderStyles`), `render.ts` (`RenderResult.styles`, the union over children, the key kept out of the state script), `stream.ts` (the links come first in the added head output, before the listener script and the preload links), `response.ts` (`style-src` in the policy).
- `examples/todo`: `todo.css` (plain), `todo.module.css` (CSS Module on the count), `env.d.ts` for the module types.
- `packages/idlip/src/testing/modules.ts`: `mount` loads no stylesheet.
- Docs: `website/docs/styles.md`, and the policy text of `deploying.md`, `head.md` and `reference/server.md`. The sidebar lists the page from its front matter (Guide, order 14).
- Tests: `test/styles/{server,build,mount}.test.ts`, `e2e/tests/styles.spec.ts` (production, `hot`, `hot-fallback`), `e2e/tests/styles-hot.spec.ts`.
- Changeset `.changeset/component-styles.md` (`idlip`, minor).

## Acceptance

- E2E on the todo example reads a computed style from the plain stylesheet and from the CSS Module (before and after a click) in the production build served by Nitro, in `vite dev` with Nitro and in `vite dev` with the plugin middleware: pass.
- A stylesheet imported only by a child that renders after a click is linked on first load: `test/styles/build.test.ts` (real compiler, a build, the server's response): pass.
- Loader: `loader.DejSiby1.js` is the same file before and after (10,214 B, 4,087 B gzip level 9 as the e2e budget test counts, budget 4,096). No client source changed.
- Checks (the root has no `pnpm check`): `pnpm build`, `oxlint --type-aware` (no errors), `pnpm format:check`, `pnpm typecheck`, `pnpm test` (85 files, 933 passed, 35 skipped), `pnpm --filter website build` (30 pages), `pnpm --filter e2e test` (39 passed).

## Decisions of the brief

- Dev links what Vite serves (`/src/todo.css`), not Vite's injected `<style>`. Why: the link is in the first response, so there is no flash of unstyled content, and Vite's hot update already swaps a `<link>`.
- `mount` ignores stylesheets. A CSS Module import becomes an object whose names are its own keys (`styles.done` is `'done'`).
- The root's set is the union over its whole import graph, so a child that renders only after a click is covered. Splitting per route waits for `routing`.

## Deviations and gotchas

- The brief asks the compiler to keep CSS imports. I did not change it: the server module needs no stylesheet code, and the plugin finds the imports from the source. A bare import is still dropped from the compiled output.
- A client chunk never imports the stylesheet. Where it reads a CSS Module (`styles.x` in a binding or list), it gets a private copy of the class object. A shared copy would be a shared chunk and a second request on the first click.
- The page links every stylesheet of the root's import graph, not only what it renders. A stylesheet that only a never-rendered branch imports is still sent.
- `style-src` blocks the `style` attribute. `style={`--size: ${size}px`}` under `csp: true` needs `csp: { extend: { 'style-src-attr': ["'unsafe-inline'"] } }`. Not added by default.
- A stylesheet imported by a package in `node_modules` is not linked. Import it from your own code.
- In dev, a CSS Module that a click's chunk imports is also injected by Vite as a `<style>`, next to the link (same rules).
- `?inline`, `?url` and `?raw` imports are not linked.
