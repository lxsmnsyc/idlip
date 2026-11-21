import type { DomMessage } from '../core/format.ts';

function getText(value: unknown): string {
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  // Other values render with `String`, as the contract says.
  // oxlint-disable-next-line typescript/no-base-to-string
  return String(value);
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeAttr(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
}

function joinClass(value: object): string {
  const names: string[] = [];
  for (const [name, enabled] of Object.entries(value)) {
    if (enabled) {
      names.push(name);
    }
  }
  return names.join(' ');
}

/**
 * Returns a hole's value as escaped text.
 */
export function text(value: unknown): string {
  return escapeText(getText(value));
}

/**
 * Returns an attribute with a leading space, or an empty string when it is absent.
 */
export function attr(name: string, value: unknown): string {
  if (value === false || value === null || value === undefined) {
    return '';
  }
  if (value === true) {
    return ` ${name}`;
  }
  if (name === 'class' && typeof value === 'object') {
    // `class` takes an object: the names whose values are truthy.
    const names = joinClass(value);
    return names === '' ? '' : ` ${name}="${escapeAttr(names)}"`;
  }
  return ` ${name}="${escapeAttr(getText(value))}"`;
}

/**
 * Returns an `on:<event>` attribute with a leading space.
 */
export function on(event: string, message: DomMessage): string {
  const json = JSON.stringify(message).replaceAll('&', '&amp;').replaceAll("'", '&#39;');
  return ` on:${event}='${json}'`;
}
