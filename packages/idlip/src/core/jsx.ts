// The JSX namespace has to be a namespace, and TypeScript reads its empty interfaces.
// oxlint-disable typescript/no-namespace, typescript/no-empty-object-type

/**
 * The JSX namespace that `idlip/jsx-runtime` exports. `jsx-types` fills in
 * `IntrinsicElements`.
 */
export declare namespace JSX {
  /**
   * What a component returns. It exists only as a type, because the compiler
   * replaces every view and the component body never runs.
   */
  interface Element {
    readonly __idlip: unique symbol;
  }

  interface ElementChildrenAttribute {
    children: unknown;
  }

  interface IntrinsicAttributes {
    key?: string | number;
  }

  interface IntrinsicElements {}
}
