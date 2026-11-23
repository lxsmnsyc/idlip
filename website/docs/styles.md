---
title: Styles
order: 14
section: Guide
description: Import a stylesheet or a CSS Module from a component. The server links every stylesheet of the page in the head, in a build and in dev.
---

Write styles the way Vite does. A component imports a stylesheet, and the page links it. idlip has no `<style>` block and no scoping of its own.

## A stylesheet

`import './todo.css'` is a global stylesheet. Its rules apply to the whole page:

```css
/* todo.css */
body {
  max-width: 28rem;
  margin: 2rem auto;
}
```

```tsx
import './todo.css';

export default function TodoApp() {
  return (
    <html lang="en">
      <head>
        <title>todo</title>
      </head>
      <body>
        <main>Hello</main>
      </body>
    </html>
  );
}
```

Sass, Less, Stylus and PostCSS files work when Vite has the preprocessor installed, as in any Vite app.

## A CSS Module

A file named `*.module.css` is a CSS Module. Its class names are scoped to the file, and the import is an object of them:

```css
/* todo.module.css */
.item {
  color: rgb(10, 20, 30);
}

.done {
  color: rgb(120, 120, 120);
  text-decoration: line-through;
}
```

```tsx
import styles from './todo.module.css';

export default function Row(props: { done: boolean }) {
  return <li class={props.done ? styles.done : styles.item}>Write the docs</li>;
}
```

The object is a plain value. Use it in the view, in a hole or in a handler. The server writes the scoped names (`_done_1f5ng_7`), and the chunk that a click loads holds the same names, so a class that a click sets matches the rule in the stylesheet.

## A value in a stylesheet

A stylesheet reads a model value through a custom property. Set it with `style`, as text or as an object:

```tsx fragment
<div class="bar" style={`--size: ${size}px`} />
<div class="bar" style={{ '--size': `${size}px` }} />
```

```css
.bar {
  width: var(--size);
}
```

An object becomes CSS text. A key that starts with `--` is written as given. Any other key goes from camelCase to kebab-case, so `backgroundColor` is `background-color`. A `null`, `undefined` or `false` value is dropped. A number is written as it is, with no `px`, so write `{ width: '10px' }` and not `{ width: 10 }`. An object of literals is folded to text when the page is compiled, and an object with a model value is converted on the server and again when a click patches it.

## Where the links go

The server writes one `<link rel="stylesheet">` for each stylesheet that the root component can reach, in `<head>`, before the preload links. It needs no option. The stylesheets of the whole import graph of the root are linked: the root's own imports, and those of every component it imports, including a child that only renders after a click, in a `<For>` body or in a condition. The first click then finds its styles already on the page, with no request. A stylesheet that two components import is linked once.

Splitting the links by route is the job of the router, which idlip does not have yet.

A stylesheet that a plain `.ts` file imports counts too, when a component imports that file. A stylesheet that a package in `node_modules` imports does not: import it from your own code.

To keep a stylesheet out of the links, import it with `?inline` or `?url`. Vite then gives you the text or the URL, and the page does not link it.

## Development

`vite dev` links the stylesheet files that Vite serves, such as `/src/todo.css`. The first response has the links, so the first paint is styled. An edit of a stylesheet reaches the open page through Vite's own hot update, with no reload and no loss of the model.

A CSS Module that a click loads also reaches the page through Vite's usual style tag in dev, next to the link. The rules are the same, so nothing shows twice.

## Content security policy

With `csp: true`, the policy has `style-src 'self' 'nonce-…'`: the stylesheets of the build come from the page's own origin, and the links carry the nonce. A `style-src` in `csp.extend` replaces both, for a page that loads a stylesheet from another origin:

```ts
renderToResponse(App, props, {
  csp: { extend: { 'style-src': ["'self'", 'https://fonts.example'] } },
});
```

A `style` attribute is an inline style, which `style-src` does not allow, so ``style={`--size: ${size}px`}`` needs `style-src-attr`: `csp: { extend: { 'style-src-attr': ["'unsafe-inline'"] } }`. A class from a stylesheet needs nothing.

## Testing

`mount` from `idlip/testing` loads no stylesheet. A CSS Module import becomes an object whose class names are their own keys: `styles.done` is `'done'`, so a test selects by those names. A plain stylesheet import is dropped.

## Deploying

A build writes each stylesheet to the client folder under `assets/`, with a hash in its name, and the server's chunk map has the URLs. Serve the folder as the other assets (see [Deploying](./deploying.md)). The previous build's stylesheets stay with its chunks, so a page cached from the last deploy keeps its styles.
