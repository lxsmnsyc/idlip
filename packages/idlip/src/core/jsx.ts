// The JSX namespace has to be a namespace, and TypeScript reads its empty interfaces.
// oxlint-disable typescript/no-namespace, typescript/no-empty-object-type

/**
 * The core JSX namespace. `idlip/jsx-runtime` declares the namespace tsc reads, with
 * `Element` as an alias of this one and `IntrinsicElements` filled.
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
    key?: string | number | ((item: never) => string | number);
  }

  interface IntrinsicElements {}
}
