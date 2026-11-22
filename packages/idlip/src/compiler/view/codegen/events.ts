// Prints the DOM message of an event: a JSON attribute when it is fixed, or JS that builds it.
import type { Component, Event, Expr } from '../analyze/index.ts';
import { listHandlerProps } from '../../update/index.ts';
import type { Emitter } from './expr.ts';
import { getAccessor, toLiteral } from './text.ts';

/**
 * One payload item. A fixed item has a JSON `value`. Any item has the JS `code` that builds it.
 */
interface Item {
  fixed: boolean;
  value: unknown;
  code: string;
}

function createFixed(value: unknown): Item {
  return { fixed: true, value, code: toLiteral(value) };
}

function createDynamic(code: string): Item {
  return { fixed: false, value: undefined, code };
}

function toItems(exprs: readonly Expr[], emitter: Emitter): Item[] {
  const items: Item[] = [];
  for (const expr of exprs) {
    items.push(toItem(expr, emitter));
  }
  return items;
}

function isFixed(items: readonly Item[]): boolean {
  for (const item of items) {
    if (!item.fixed) {
      return false;
    }
  }
  return true;
}

function getValues(items: readonly Item[]): unknown[] {
  const values: unknown[] = [];
  for (const item of items) {
    values.push(item.value);
  }
  return values;
}

function printItems(items: readonly Item[]): string {
  const codes: string[] = [];
  for (const item of items) {
    codes.push(item.code);
  }
  return `[${codes.join(', ')}]`;
}

/** Turns one argument into a JSON value when it is fixed, else into JS. */
function toItem(expr: Expr, emitter: Emitter): Item {
  switch (expr.kind) {
    case 'literal':
      return createFixed(expr.value ?? null);
    case 'path': {
      // The listener reads the event when it fires.
      if (expr.root.kind !== 'event') {
        return createDynamic(emitter.expr(expr, 1));
      }
      const segments: string[] = [];
      for (const segment of expr.segments) {
        if (typeof segment !== 'string') {
          emitter.fail(
            'event-computed-key',
            'An event argument reads fields by a fixed name, such as elements.draft.value',
          );
          break;
        }
        segments.push(segment);
      }
      return createFixed(['$event', ...segments]);
    }
    case 'array': {
      const items = toItems(expr.items, emitter);
      return isFixed(items) ? createFixed(getValues(items)) : createDynamic(printItems(items));
    }
    case 'object': {
      const value: Record<string, unknown> = {};
      let fixed = true;
      for (const entry of expr.entries) {
        const item = toItem(entry.value, emitter);
        fixed = fixed && item.fixed;
        value[entry.key] = item.value;
      }
      return fixed ? createFixed(value) : createDynamic(emitter.expr(expr, 1));
    }
    default:
      return createDynamic(emitter.expr(expr, 1));
  }
}

/** Tells whether an argument is fixed, as `toItem` decides, without printing it. */
function isFixedExpr(expr: Expr): boolean {
  switch (expr.kind) {
    case 'literal':
      return true;
    case 'path':
      return expr.root.kind === 'event';
    case 'array':
      for (const item of expr.items) {
        if (!isFixedExpr(item)) {
          return false;
        }
      }
      return true;
    case 'object':
      for (const entry of expr.entries) {
        if (!isFixedExpr(entry.value)) {
          return false;
        }
      }
      return true;
    default:
      return false;
  }
}

/**
 * Tells whether the message of an event reads nothing at render, so `getMessage` returns JSON.
 * An event that writes no message, such as a `reset`, counts as fixed.
 */
export function isFixedMessage(component: Component, event: Event): boolean {
  if (event.target.kind === 'prop') {
    return false;
  }
  if (event.target.kind !== 'handler') {
    return true;
  }
  const tag = event.target.name;
  for (const handler of component.handlers) {
    if (handler.name === tag && listHandlerProps(component, handler).length > 0) {
      return false;
    }
  }
  for (const arg of event.args) {
    if (!isFixedExpr(arg)) {
      return false;
    }
  }
  return true;
}

export interface Message {
  /** The `DomMessage` as JSON, when nothing in it is read at render. */
  json: string | undefined;
  /** JS that builds the `DomMessage`. */
  code: string;
}

/** Returns the modifiers of an event, joined by spaces, as the third item of the message. */
export function printModifiers(event: Event): string {
  const names: string[] = [];
  for (const modifier of event.modifiers) {
    names.push(modifier.kind === 'key' ? `key:${modifier.filter}` : modifier.kind);
  }
  if (event.mode === 'latest') {
    names.push('latest');
  }
  return names.join(' ');
}

/**
 * Builds the message of an event: the handler tag, the props values, then the arguments. An
 * event on a prop forwards the message that the parent passed. With `owner`, the message is
 * a message prop: its fourth item is the code of the model path of the component that owns the
 * handler.
 */
export function getMessage(
  component: Component,
  event: Event,
  emitter: Emitter,
  owner?: string,
): Message {
  emitter.at = event.span;
  if (event.target.kind === 'prop') {
    const path: Expr = {
      kind: 'path',
      root: { kind: 'props' },
      segments: [event.target.name],
      optional: false,
    };
    return { json: undefined, code: emitter.expr(path, 0) };
  }
  const tag = event.target.kind === 'handler' ? event.target.name : '';
  // Props values come first, then the arguments. `compile-update` owns the list.
  const items: Item[] = [];
  let handler: Component['handlers'][number] | undefined;
  for (const candidate of component.handlers) {
    if (candidate.name === tag) {
      handler = candidate;
    }
  }
  const propsPaths = handler === undefined ? [] : listHandlerProps(component, handler);
  for (const path of propsPaths) {
    const segments = path.split('.');
    if (emitter.mode === 'client') {
      emitter.usage.scope.add('props');
      emitter.usage.props.add(segments[0]);
    }
    let code = 'props';
    for (const segment of segments) {
      code += getAccessor(segment, false);
    }
    items.push(createDynamic(code));
  }
  const args = toItems(event.args, emitter);
  // `['$', ...]` marks a literal array whose first item starts with `$`.
  for (const [index, arg] of event.args.entries()) {
    const first = arg.kind === 'array' ? arg.items.at(0) : undefined;
    const item = args[index];
    if (
      first?.kind === 'literal' &&
      typeof first.value === 'string' &&
      first.value.startsWith('$')
    ) {
      args[index] = item.fixed
        ? createFixed(['$', ...getValues([item]).flat()])
        : createDynamic(`['$', ${item.code.slice(1)}`);
    }
  }
  items.push(...args);
  const modifiers = printModifiers(event);
  let json: string | undefined;
  if (owner === undefined && isFixed(items)) {
    const payload = getValues(items);
    json = JSON.stringify(modifiers === '' ? [tag, payload] : [tag, payload, modifiers]);
  }
  const parts = [toLiteral(tag), printItems(items)];
  if (owner !== undefined) {
    parts.push(toLiteral(modifiers), owner);
  } else if (modifiers !== '') {
    parts.push(toLiteral(modifiers));
  }
  return { json, code: `[${parts.join(', ')}]` };
}
