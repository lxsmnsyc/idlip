/** A ref name: a string literal, or a literal with the key of the row it is in. */
export type RefName = string | readonly [string, string | number];

/** The box of an element, as plain numbers so a message log can hold it. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** The functions of `Dom` that a handler calls without awaiting. They run after the patch. */
export type DomCall = 'focus' | 'scrollIntoView' | 'reset';

/** Returns the `i-ref` value of a ref name: `search`, or `row a1` for `['row', 'a1']`. */
export function getRefValue(ref: RefName): string {
  return typeof ref === 'string' ? ref : `${ref[0]} ${ref[1]}`;
}

/** Finds the element with a ref name under a root. */
export function findRef(root: ParentNode, ref: RefName): Element | undefined {
  const value = getRefValue(ref);
  for (const element of root.querySelectorAll('[i-ref]')) {
    if (element.getAttribute('i-ref') === value) {
      return element;
    }
  }
  return undefined;
}

/** Runs one call on the element of a ref under a root. A missing ref warns and does nothing. */
export function callDom(root: ParentNode, call: DomCall, ref: RefName): void {
  const element = findRef(root, ref);
  if (element === undefined) {
    // oxlint-disable-next-line no-console
    console.warn(`idlip: no ref ${getRefValue(ref)}`);
  } else if (call === 'focus') {
    if (element instanceof HTMLElement || element instanceof SVGElement) {
      element.focus();
    }
  } else if (call === 'scrollIntoView') {
    element.scrollIntoView();
  } else if (element instanceof HTMLFormElement) {
    element.reset();
  } else if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.value = element.defaultValue;
    if (element instanceof HTMLInputElement) {
      element.checked = element.defaultChecked;
    }
  }
}

// oxlint-disable-next-line typescript/require-await
async function measure(ref: RefName): Promise<Rect | null> {
  const element = findRef(document, ref);
  if (element === undefined) {
    // oxlint-disable-next-line no-console
    console.warn(`idlip: no ref ${getRefValue(ref)}`);
    return null;
  }
  const { x, y, width, height } = element.getBoundingClientRect();
  return { x, y, width, height };
}

/**
 * Calls on the elements of the page, by the name of their `ref`. In a compiled handler,
 * `focus`, `scrollIntoView` and `reset` run once after the batch's patch, so an element that
 * the same message adds is found. `await Dom.measure(ref)` gives a plain rect, or `null` with a warning when no element has the ref.
 */
export const Dom: {
  focus(ref: RefName): void;
  scrollIntoView(ref: RefName): void;
  measure(ref: RefName): Promise<Rect | null>;
  reset(ref: RefName): void;
} = {
  focus: (ref) => {
    callDom(document, 'focus', ref);
  },
  scrollIntoView: (ref) => {
    callDom(document, 'scrollIntoView', ref);
  },
  measure,
  reset: (ref) => {
    callDom(document, 'reset', ref);
  },
};
