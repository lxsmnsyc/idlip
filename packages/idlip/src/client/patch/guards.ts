import type { Binding } from '../../core/format.ts';
import { HAS_CHILDREN } from '../features.ts';

const MARKER = HAS_CHILDREN ? /^(?:[tcl]\d+|n:)/ : /^[tcl]\d+/;

/** Returns the binding name of a text, condition or list start comment, such as `c3` for `c3:0`, or `n:` for a boundary. */
export function matchMarker(data: string): string | undefined {
  return MARKER.exec(data)?.[0];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isComment(node: Node | null): node is Comment {
  return node?.nodeType === 8;
}

export function isElement(node: Node | null): node is Element {
  return node?.nodeType === 1;
}

export function isBinding(value: unknown): value is Binding {
  return typeof value === 'function';
}
