import type { EventProp } from '../../../src/core/events.ts';
import type { JSX as CoreJSX } from '../../../src/core/jsx.ts';

// oxlint-disable typescript/no-namespace

/**
 * A small JSX runtime for the type tests. It reuses the core types and declares
 * a few intrinsic elements, so these tests do not depend on `jsx-types`.
 */
export declare namespace JSX {
  type Element = CoreJSX.Element;
  type ElementChildrenAttribute = CoreJSX.ElementChildrenAttribute;
  type IntrinsicAttributes = CoreJSX.IntrinsicAttributes;

  interface IntrinsicElements {
    main: { children?: unknown };
    p: { children?: unknown };
    li: { class?: string | Record<string, boolean>; children?: unknown };
    button: {
      disabled?: boolean;
      'on:click'?: EventProp<HTMLButtonElement, MouseEvent>;
      children?: unknown;
    };
    input: {
      type?: string;
      value?: string;
      checked?: boolean;
      'on:input'?: EventProp<HTMLInputElement, InputEvent>;
      'on:click'?: EventProp<HTMLInputElement, MouseEvent>;
    };
  }
}
