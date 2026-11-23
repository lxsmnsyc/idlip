// Prints the code of an event: a JSON attribute or JS for a message built at render (a message
// prop, a forwarded one, a reset), and the function of an event arrow that runs when it dispatches.
import type { Component, Event, EventBody, EventStep, Expr } from '../analyze/index.ts';
import { listHandlerProps } from '../../update/index.ts';
import type { Emitter } from './expr.ts';
import { getAccessor, quote, toLiteral } from './text.ts';

/** The `message` form of an event body, or `undefined` for steps. */
export function getMessageBody(event: Event): Extract<EventBody, { kind: 'message' }> | undefined {
  return event.body.kind === 'message' ? event.body : undefined;
}

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
    case 'array': {
      const items = toItems(expr.items, emitter);
      return isFixed(items) ? createFixed(getValues(items)) : createDynamic(printItems(items));
    }
    default:
      return createDynamic(emitter.expr(expr, 1));
  }
}

/** Tells whether an argument is fixed, as `toItem` decides, without printing it. */
function isFixedExpr(expr: Expr): boolean {
  if (expr.kind === 'array') {
    for (const item of expr.items) {
      if (!isFixedExpr(item)) {
        return false;
      }
    }
    return true;
  }
  return expr.kind === 'literal';
}

/**
 * Tells whether the message of an event reads nothing at render, so `getMessage` returns JSON.
 * A reset writes no message, so it counts as fixed.
 */
export function isFixedMessage(component: Component, event: Event): boolean {
  const body = getMessageBody(event);
  if (body === undefined || body.target.kind === 'prop') {
    return false;
  }
  if (body.target.kind !== 'handler') {
    return true;
  }
  const tag = body.target.name;
  for (const handler of component.handlers) {
    if (handler.name === tag && listHandlerProps(component, handler).length > 0) {
      return false;
    }
  }
  for (const arg of body.args) {
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

/**
 * Returns the modifiers of an event, joined by spaces, as the third item of the message or the
 * tail of the attribute. A conditional prevent is one `prevent:<filter>` token per key filter.
 */
export function printModifiers(event: Event): string {
  const names: string[] = [];
  for (const modifier of event.modifiers) {
    if (modifier.kind === 'key') {
      names.push(`key:${modifier.filter}`);
    } else if (modifier.kind === 'prevent' && modifier.keys !== undefined) {
      for (const key of modifier.keys) {
        names.push(`prevent:${key}`);
      }
    } else {
      names.push(modifier.kind);
    }
  }
  if (event.mode === 'latest') {
    names.push('latest');
  }
  return names.join(' ');
}

/**
 * Builds the message of a message event: the handler tag, the props values, then the
 * arguments. An event on a prop forwards the message that the parent passed. With `owner`, the
 * message is a message prop: its fourth item is the code of the model path of the component that
 * owns the handler.
 */
export function getMessage(
  component: Component,
  event: Event,
  emitter: Emitter,
  owner?: string,
): Message {
  emitter.at = event.span;
  const body = getMessageBody(event);
  if (body === undefined) {
    return { json: undefined, code: 'undefined' };
  }
  if (body.target.kind === 'prop') {
    const path: Expr = {
      kind: 'path',
      root: { kind: 'props' },
      segments: [body.target.name],
      optional: false,
    };
    return { json: undefined, code: emitter.expr(path, 0) };
  }
  const tag = body.target.kind === 'handler' ? body.target.name : '';
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
  items.push(...toItems(body.args, emitter));
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

/** The message of a handler call in an event function: `['toggle', [rows[0].item.id]]`. */
function printSend(
  component: Component,
  step: Extract<EventStep, { kind: 'send' }>,
  emitter: Emitter,
): string {
  const tag = step.target.kind === 'handler' ? step.target.name : '';
  emitter.at = step.span;
  const items: string[] = [];
  let handler: Component['handlers'][number] | undefined;
  for (const candidate of component.handlers) {
    if (candidate.name === tag) {
      handler = candidate;
    }
  }
  // Props values come first, then the arguments, as in a message built at render.
  for (const path of handler === undefined ? [] : listHandlerProps(component, handler)) {
    const segments = path.split('.');
    emitter.usage.scope.add('props');
    emitter.usage.props.add(segments[0]);
    let code = 'props';
    for (const segment of segments) {
      code += getAccessor(segment, false);
    }
    items.push(code);
  }
  for (const arg of step.args) {
    items.push(emitter.expr(arg, 1));
  }
  return `[${quote(tag)}, [${items.join(', ')}]]`;
}

function printSteps(
  component: Component,
  steps: readonly EventStep[],
  emitter: Emitter,
  indent: string,
  out: string[],
): void {
  for (const step of steps) {
    if (step.kind === 'send') {
      out.push(`${indent}$m.push(${printSend(component, step, emitter)});`);
      continue;
    }
    out.push(`${indent}if (${emitter.expr(step.test, 0)}) {`);
    printSteps(component, step.then, emitter, `${indent}  `, out);
    if (step.else.length > 0) {
      out.push(`${indent}} else {`);
      printSteps(component, step.else, emitter, `${indent}  `, out);
    }
    out.push(`${indent}}`);
  }
}

/** Lists the handler names an event may send, in source order and once each. */
export function listSendTags(steps: readonly EventStep[], into: string[] = []): string[] {
  for (const step of steps) {
    if (step.kind === 'send') {
      if (step.target.kind === 'handler' && !into.includes(step.target.name)) {
        into.push(step.target.name);
      }
    } else {
      listSendTags(step.then, into);
      listSendTags(step.else, into);
    }
  }
  return into;
}

/**
 * Prints the body of an event function: it returns the messages the event sends. One call
 * returns its message at once, and anything else collects them in `$m`.
 */
export function printEventBody(
  component: Component,
  steps: readonly EventStep[],
  emitter: Emitter,
): string[] {
  emitter.inEvent = true;
  const [only] = steps;
  if (steps.length === 1 && only.kind === 'send') {
    const line = `return [${printSend(component, only, emitter)}];`;
    emitter.inEvent = false;
    return [line];
  }
  const lines = ['const $m = [];'];
  printSteps(component, steps, emitter, '', lines);
  lines.push('return $m;');
  emitter.inEvent = false;
  return lines;
}
