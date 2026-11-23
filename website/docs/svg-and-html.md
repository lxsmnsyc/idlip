---
title: SVG, raw HTML and URLs
order: 21
section: Guide
description: Write SVG and MathML in a view, insert markup with trusted, and what idlip checks in a bound URL.
---

## SVG

Write SVG in the view as you would in HTML. Holes, conditions and `<For>` rows inside `<svg>` work as elsewhere, and the browser gets SVG elements:

```tsx live
import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

interface Point {
  id: string;
  x: number;
  y: number;
}

export default function Chart(props: { points: Point[] }): JSX.Element {
  let points = props.points;

  function add() {
    points = [...points, { id: `p${points.length}`, x: points.length * 10, y: 50 }];
  }

  return (
    <svg viewBox="0 0 100 100" width="200" on:click={add}>
      <title>Points</title>
      <For each={points} key={(point) => point.id}>
        {(point) => <circle cx={point.x} cy={point.y} r="2" />}
      </For>
      <foreignObject x="0" y="0" width="100" height="20">
        <p>{points.length > 9 && <strong>Full</strong>}</p>
      </foreignObject>
    </svg>
  );
}
```

```json live props.json
{
  "points": [
    {
      "id": "p0",
      "x": 0,
      "y": 80
    },
    {
      "id": "p1",
      "x": 10,
      "y": 40
    },
    {
      "id": "p2",
      "x": 20,
      "y": 60
    }
  ]
}
```

- **Namespaces.** Rows and branches inside `<svg>` are created as SVG. Children of `<foreignObject>` are HTML again. `<math>` works the same way for MathML.
- **`<title>` inside `<svg>`** is the SVG title of the drawing. It is not the document title.
- **Events** use `on:click` as on HTML elements. A plain `onclick` attribute is the error `attr-event`.

## Raw HTML

The `html` attribute sets the content of an element from a string of markup. Its value must be a `trusted(...)` call, with `trusted` imported from `idlip`:

```tsx live
import { trusted } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

export default function Post(props: { body: string }): JSX.Element {
  let body = props.body;

  function clear() {
    body = '';
  }

  return (
    <article>
      <div html={trusted(body)} />
      <button on:click={clear}>Clear</button>
    </article>
  );
}
```

```json live props.json
{
  "body": "<p>A post with <strong>bold</strong> text.</p>"
}
```

`trusted` does not sanitize or escape anything. The call marks the place where you vouch for the markup, so pass only markup you wrote or cleaned with a sanitizer. When `body` changes, the element's content is replaced.

The compiler checks the use:

| Rule id          | Cause                                                                            |
| ---------------- | -------------------------------------------------------------------------------- |
| `html-trusted`   | `html={value}` where the value is not a call of the `trusted` export of `idlip`. |
| `html-children`  | An element with `html` that also has children.                                   |
| `html-element`   | `html` on `<script>`, `<style>`, `<textarea>`, `<title>` or `<noscript>`.        |
| `srcdoc-trusted` | A bound `srcdoc` that is not `trusted(...)`. A literal `srcdoc` is allowed.      |

`trusted` may be imported under another name. A local function named `trusted` does not count.

The page's Trusted Types policy is named `idlip`. Under a CSP with `require-trusted-types-for 'script'`, allow it with `trusted-types idlip`.

## Bound URLs

A hole in a URL attribute is checked on the server and in the browser. The attributes are `href`, `src`, `action`, `formaction`, `xlink:href`, `poster`, `cite`, `data`, `background`, `codebase`, `longdesc`, `manifest`, `ping` and `profile`.

- **Script URLs are dropped.** A value that starts with `javascript:` or `vbscript:` leaves the attribute out. Spaces and control characters in the scheme do not hide it.
- **Frames drop `data:` too.** This holds for `<iframe src>`, `<embed src>` and `<object data>`. A PNG, GIF, JPEG, WebP, AVIF or BMP image is allowed.
- **Objects and functions are dropped**, whatever they would print as.
- **SVG animation.** An `<animate>` or `<set>` that animates `href` checks its `to`, `from`, `by` and `values`.
- **A literal is not checked.** `<a href="javascript:void 0">` in the source is written as is, since you wrote it.

In development, the browser console warns each time a URL is dropped.

```tsx live
import type { JSX } from 'idlip/jsx-runtime';

export default function Profile(props: { site: string }): JSX.Element {
  let site = props.site;

  function reset() {
    site = 'https://example.com';
  }

  return (
    <p>
      <a href={site}>Website</a>
      <button on:click={reset}>Reset</button>
    </p>
  );
}
```

```json live props.json
{
  "site": "https://example.com"
}
```

With `site` set to `javascript:alert(1)`, the link renders with no `href`.

See [idlip](./reference/idlip.md#trusted) for `trusted` and [idlip/server](./reference/server.md#safeurl) for the URL check.
