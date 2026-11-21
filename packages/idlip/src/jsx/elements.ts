import type { TrustedHtml } from '../core/trusted.ts';

// Like `EventProp`, for any event target, since `window` and `document` are not elements.
type TargetProp<T extends EventTarget, E extends Event> = (
  event: E & { readonly currentTarget: T },
) => unknown;

/**
 * `on:*` props for an element. Each takes a function of the element's event.
 */
export type OnProps<El extends EventTarget, Map> = {
  [K in keyof Map & string as `on:${K}`]?: Map[K] extends Event ? TargetProp<El, Map[K]> : never;
};

/**
 * `latest:*` props. They take the same functions as `on:*` and opt into latest-wins delivery.
 */
export type LatestProps<El extends EventTarget, Map> = {
  [K in keyof Map & string as `latest:${K}`]?: Map[K] extends Event
    ? TargetProp<El, Map[K]>
    : never;
};

export type EventProps<El extends EventTarget, Map> = OnProps<El, Map> & LatestProps<El, Map>;

/**
 * A class is a string, or a record of booleans where each true key is added.
 */
export type ClassValue = string | Record<string, boolean | null | undefined>;

/**
 * Attributes on every element. `html` takes only `TrustedHtml`.
 */
export interface CommonAttributes {
  class?: ClassValue;
  id?: string;
  title?: string;
  lang?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  hidden?: boolean;
  tabindex?: number;
  role?: string;
  style?: string;
  slot?: string;
  draggable?: boolean;
  contenteditable?: boolean | 'true' | 'false' | 'plaintext-only';
  ref?: string | readonly [string, string | number];
  html?: TrustedHtml;
  key?: string | number;
  children?: unknown;
  [aria: `aria-${string}`]: string | number | boolean | undefined;
  [data: `data-${string}`]: string | number | boolean | undefined;
}

export interface AnchorAttributes {
  href?: string;
  target?: '_self' | '_blank' | '_parent' | '_top' | (string & {});
  rel?: string;
  download?: string | boolean;
}

export interface ButtonAttributes {
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  name?: string;
  value?: string;
}

export interface InputAttributes {
  type?: string;
  name?: string;
  value?: string | number;
  checked?: boolean;
  disabled?: boolean;
  placeholder?: string;
  readonly?: boolean;
  required?: boolean;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  maxlength?: number;
  pattern?: string;
  autofocus?: boolean;
  autocomplete?: string;
  accept?: string;
  multiple?: boolean;
}

export interface TextAreaAttributes {
  name?: string;
  value?: string;
  disabled?: boolean;
  placeholder?: string;
  readonly?: boolean;
  required?: boolean;
  rows?: number;
  cols?: number;
  maxlength?: number;
}

export interface SelectAttributes {
  name?: string;
  value?: string;
  disabled?: boolean;
  required?: boolean;
  multiple?: boolean;
}

export interface OptionAttributes {
  value?: string;
  selected?: boolean;
  disabled?: boolean;
  label?: string;
}

export interface FormAttributes {
  action?: string;
  method?: 'get' | 'post' | 'dialog';
  novalidate?: boolean;
}

export interface LabelAttributes {
  for?: string;
}

export interface ImageAttributes {
  src?: string;
  alt?: string;
  width?: number | string;
  height?: number | string;
  loading?: 'eager' | 'lazy';
}

export interface MetaAttributes {
  name?: string;
  content?: string;
  charset?: string;
  property?: string;
  'http-equiv'?: string;
}

export interface LinkAttributes {
  rel?: string;
  href?: string;
  type?: string;
  media?: string;
  sizes?: string;
  as?: string;
  crossorigin?: 'anonymous' | 'use-credentials' | '';
}

/**
 * Attributes that are specific to a tag. Tags that are not listed take only the common ones.
 */
export interface SpecificAttributes {
  a: AnchorAttributes;
  button: ButtonAttributes;
  input: InputAttributes;
  textarea: TextAreaAttributes;
  select: SelectAttributes;
  option: OptionAttributes;
  form: FormAttributes;
  label: LabelAttributes;
  img: ImageAttributes;
  meta: MetaAttributes;
  link: LinkAttributes;
}

/** What an event arrow reads from a named field of a form, such as `e.currentTarget.elements.draft.value`. */
export interface FormField {
  readonly value: string;
  readonly checked: boolean;
  readonly valueAsNumber: number;
}

/** A form whose `elements` has a named field for each name an arrow reads. */
export type FormElement = EventTarget &
  Pick<
    HTMLFormElement,
    'action' | 'checkValidity' | 'id' | 'method' | 'name' | 'reportValidity' | 'reset'
  > & {
    readonly elements: Readonly<Record<string, FormField>>;
  };

interface TargetOverrides {
  form: FormElement;
}

type TargetOf<Tag extends keyof HTMLElementTagNameMap> = Tag extends keyof TargetOverrides
  ? TargetOverrides[Tag]
  : HTMLElementTagNameMap[Tag];

type ElementProps<Tag extends keyof HTMLElementTagNameMap> = CommonAttributes &
  (Tag extends keyof SpecificAttributes ? SpecificAttributes[Tag] : unknown) &
  (TargetOf<Tag> extends infer T extends EventTarget ? EventProps<T, HTMLElementEventMap> : never);

/**
 * Every HTML element. Its `on:*` and `latest:*` props take a function of an event whose
 * `currentTarget` is that element.
 */
export type HtmlElements = { [Tag in keyof HTMLElementTagNameMap]: ElementProps<Tag> };

/**
 * `<window>` takes only `on:*` and `latest:*` props.
 */
export type WindowProps = EventProps<Window, WindowEventMap>;

/**
 * `<document>` takes only `on:*` and `latest:*` props.
 */
export type DocumentProps = EventProps<Document, DocumentEventMap>;

export interface GlobalElements {
  window: WindowProps;
  document: DocumentProps;
}
