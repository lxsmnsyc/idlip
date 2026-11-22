import type { JSX } from './jsx.ts';

function failBlock(name: string): never {
  throw new Error(
    `<${name}> is replaced by the compiler and cannot run. Compile this file with idlip/vite.`,
  );
}

/**
 * Renders `children` once per item of `each`. `key` returns a string or number that is unique
 * among the items: `key={(todo) => todo.id}`. The body is one expression that reads the item. Only
 * one field of the item (`item.id`) keeps keyed writes (`todos[id=...]`). Any other expression, such
 * as `item.meta.id` or a template literal, moves rows by key all the same. A change to such a list
 * loads the list chunk and runs the row bindings of every row. The compiler replaces it, so calling
 * it throws.
 */
export function For<T>(_props: {
  each: readonly T[];
  key: (item: T) => string | number;
  children: (item: T, index: number) => JSX.Element;
}): JSX.Element {
  return failBlock('For');
}

/**
 * Shows `catch` when `children` throws. The compiler replaces it, so calling it throws.
 */
export function Try(_props: {
  catch: (error: unknown, reset: () => void) => JSX.Element;
  children: JSX.Element | readonly JSX.Element[];
}): JSX.Element {
  return failBlock('Try');
}

/**
 * Puts `children` in the document head. The compiler replaces it, so calling it throws.
 */
export function Head(_props: { children: JSX.Element | readonly JSX.Element[] }): JSX.Element {
  return failBlock('Head');
}

/**
 * Runs `to(input, signal)` while mounted and sends each value to `on:value`.
 * The compiler replaces it, so calling it throws.
 */
export function Subscribe<I, V>(_props: {
  to: (input: I, signal: AbortSignal) => AsyncIterable<V>;
  input: I;
  'on:value': (value: V) => unknown;
}): JSX.Element {
  return failBlock('Subscribe');
}
