/**
 * Raw HTML that the author vouches for. A plain string is a type error where this is required.
 */
export type TrustedHtml = string & { readonly __trusted: unique symbol };

/**
 * Marks a string as safe to write as HTML, for `html={trusted(value)}`.
 */
export function trusted(html: string): TrustedHtml {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return html as TrustedHtml;
}
