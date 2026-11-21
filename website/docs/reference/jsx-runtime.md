---
title: idlip/jsx-runtime
order: 106
section: Reference
description: The JSX types that TypeScript reads with jsxImportSource set to idlip.
---

`idlip/jsx-runtime` holds the JSX types for `"jsxImportSource": "idlip"`. It has no runtime code: the compiler replaces every view, so a component body never runs as JSX. See [Editor setup](../editor.md) for the `tsconfig.json` settings.

```tsx no-check
import type { JSX } from 'idlip/jsx-runtime';

export default function Hello(props: { name: string }): JSX.Element {
  return <p>Hello {props.name}</p>;
}
```

## Types

### `JSX`

```ts
namespace JSX {
  type Element;
  interface ElementChildrenAttribute {
    children: unknown;
  }
  interface IntrinsicAttributes {
    key?: string | number;
  }
  interface IntrinsicElements {
    /* HTML, SVG and MathML elements, <window> and <document> */
  }
}
```

The namespace TypeScript reads for JSX. `JSX.Element` is what a component returns. It exists only as a type.

`IntrinsicElements` types every element:

- HTML elements take the common attributes (`class`, `id`, `ref`, `html`, `key`, `aria-*`, `data-*` and others), the attributes of their tag, and `on:*` and `latest:*` props for the events of the element.
- SVG and MathML elements take any attribute, plus the common ones and the event props. `html` stays `TrustedHtml`.
- `<window>` and `<document>` take only `on:*` and `latest:*` props. They listen on `window` and `document`.
- Plain `onclick` style names are type errors, since they would set an event handler attribute. Use `on:click`.
- A `<form>`'s `currentTarget.elements` has a named field for each name an event arrow reads, such as `e.currentTarget.elements.draft.value`.

`latest:*` takes the same functions as `on:*` and opts into latest-wins delivery: while a message is in flight, a newer event of the same kind replaces the queued one.

### `ClassValue`

```ts
type ClassValue = string | Record<string, boolean | null | undefined>;
```

The type of `class`. A record adds each key whose value is true: `class={{ done: t.done }}`.

### `EventFor`

```ts
type EventFor<El extends Element, E extends Event> = E & { readonly currentTarget: El };
```

An event with `currentTarget` typed as the element the listener is on.

### `EventProp`

```ts
type EventProp<El extends Element, E extends Event> = (event: EventFor<El, E>) => unknown;
```

The type of an `on:*` or `latest:*` prop. The compiler restricts the value to a handler, or an arrow function whose body is one handler call.
