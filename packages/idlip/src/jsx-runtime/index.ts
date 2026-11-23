import type { GlobalElements, HtmlElements, MathElements, SvgElements } from '../jsx/elements.ts';
import type { JSX as CoreJSX } from '../core/jsx.ts';

// oxlint-disable typescript/no-namespace, typescript/no-empty-object-type

/**
 * The JSX types for `jsxImportSource: "idlip"`. The compiler replaces every view, so
 * there is no runtime. `IntrinsicElements` holds the HTML elements, `<window>` and
 * `<document>`.
 */
export declare namespace JSX {
  type Element = CoreJSX.Element;
  interface ElementChildrenAttribute extends CoreJSX.ElementChildrenAttribute {}
  interface IntrinsicAttributes extends CoreJSX.IntrinsicAttributes {}
  interface IntrinsicElements extends HtmlElements, SvgElements, MathElements, GlobalElements {}
}

export type { EventFor, EventProp } from '../core/events.ts';
export type { ClassValue, StyleValue } from '../jsx/elements.ts';
