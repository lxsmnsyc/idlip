// oxlint-disable import/prefer-default-export
// Finds the model paths each update handler can change, for `manifest.handlers[tag].writes`.
import { parseSync } from 'oxc-parser';
import type { Node as AstNode, Function as FunctionNode } from '@oxc-project/types';
import type { Component, Handler } from '../view/analyze/index.ts';
import { listChildren, scanReferences } from './emit.ts';

function unwrap(node: AstNode): AstNode {
  let current = node;
  while (current.type === 'ParenthesizedExpression') {
    current = current.expression;
  }
  return current;
}

function getKeyName(key: AstNode): string | undefined {
  if (key.type === 'Identifier') {
    return key.name;
  }
  return key.type === 'Literal' && typeof key.value === 'string' ? key.value : undefined;
}

/**
 * Reads `x = x.map((t) => (<test> ? { ...t, f: <e> } : t))` and returns the item fields it
 * sets, so the write is `x.*.f`. Any other right side returns undefined.
 */
function readItemFields(field: string, right: AstNode): string[] | undefined {
  const call = unwrap(right);
  if (
    call.type !== 'CallExpression' ||
    call.arguments.length !== 1 ||
    call.callee.type !== 'MemberExpression' ||
    call.callee.computed ||
    call.callee.object.type !== 'Identifier' ||
    call.callee.object.name !== field ||
    call.callee.property.type !== 'Identifier' ||
    call.callee.property.name !== 'map'
  ) {
    return undefined;
  }
  const callback = call.arguments[0];
  if (
    callback.type !== 'ArrowFunctionExpression' ||
    !callback.expression ||
    callback.params.length !== 1 ||
    callback.params[0].type !== 'Identifier' ||
    callback.body.type === 'BlockStatement'
  ) {
    return undefined;
  }
  const item = callback.params[0].name;
  const choice = unwrap(callback.body);
  if (choice.type !== 'ConditionalExpression') {
    return undefined;
  }
  const keep = unwrap(choice.alternate);
  const change = unwrap(choice.consequent);
  if (keep.type !== 'Identifier' || keep.name !== item || change.type !== 'ObjectExpression') {
    return undefined;
  }
  const [first, ...rest] = change.properties;
  if (
    rest.length === 0 ||
    first.type !== 'SpreadElement' ||
    first.argument.type !== 'Identifier' ||
    first.argument.name !== item
  ) {
    return undefined;
  }
  const fields: string[] = [];
  for (const property of rest) {
    if (property.type !== 'Property' || property.computed || property.kind !== 'init') {
      return undefined;
    }
    const name = getKeyName(property.key);
    if (name === undefined) {
      return undefined;
    }
    fields.push(name);
  }
  return fields;
}

/** Collects the fields of each assignment that matches the item pattern, by target position. */
function findItemWrites(node: AstNode, into: Map<number, string[]>): void {
  if (
    node.type === 'AssignmentExpression' &&
    node.operator === '=' &&
    node.left.type === 'Identifier'
  ) {
    const fields = readItemFields(node.left.name, node.right);
    if (fields !== undefined) {
      into.set(node.left.start, fields);
    }
  }
  for (const child of listChildren(node)) {
    findItemWrites(child, into);
  }
}

/** Methods that change their receiver in place. */
const MUTATORS = new Set([
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
  'fill',
  'copyWithin',
  'set',
  'add',
  'delete',
  'clear',
]);

/** Returns the name at the root of a member chain, such as `todos` for `todos[0].done`. */
function getRootName(node: AstNode): string | undefined {
  let current = unwrap(node);
  for (;;) {
    if (current.type === 'MemberExpression') {
      current = unwrap(current.object);
    } else if (current.type === 'ChainExpression') {
      current = unwrap(current.expression);
    } else if (current.type === 'TSNonNullExpression') {
      current = unwrap(current.expression);
    } else {
      return current.type === 'Identifier' ? current.name : undefined;
    }
  }
}

/** What a body does to state that the plain assignments do not show. */
interface Effects {
  /** Fields written through a pattern or a loop target. */
  fields: string[];
  /** A write the analysis cannot read: the handler gets no write set. */
  unknown: boolean;
}

/** Reads the names a destructuring target assigns. A member target is an unknown write. */
function readTarget(target: AstNode, state: ReadonlySet<string>, effects: Effects): void {
  switch (target.type) {
    case 'Identifier':
      if (state.has(target.name)) {
        effects.fields.push(target.name);
      }
      break;
    case 'MemberExpression':
      if (state.has(getRootName(target) ?? '')) {
        effects.unknown = true;
      }
      break;
    case 'ObjectPattern':
      for (const property of target.properties) {
        readTarget(
          property.type === 'RestElement' ? property.argument : property.value,
          state,
          effects,
        );
      }
      break;
    case 'ArrayPattern':
      for (const element of target.elements) {
        if (element !== null) {
          readTarget(element, state, effects);
        }
      }
      break;
    case 'AssignmentPattern':
      readTarget(target.left, state, effects);
      break;
    case 'RestElement':
      readTarget(target.argument, state, effects);
      break;
    default:
      effects.unknown = true;
  }
}

/** Finds the writes of a body that are not a plain `x = ...`. */
function findEffects(node: AstNode, state: ReadonlySet<string>, effects: Effects): void {
  if (node.type === 'AssignmentExpression' && node.left.type !== 'Identifier') {
    readTarget(node.left, state, effects);
  } else if (node.type === 'UpdateExpression' && node.argument.type !== 'Identifier') {
    readTarget(node.argument, state, effects);
  } else if (
    node.type === 'UnaryExpression' &&
    node.operator === 'delete' &&
    state.has(getRootName(node.argument) ?? '')
  ) {
    effects.unknown = true;
  } else if (
    (node.type === 'ForOfStatement' || node.type === 'ForInStatement') &&
    node.left.type !== 'VariableDeclaration'
  ) {
    readTarget(node.left, state, effects);
  } else if (node.type === 'CallExpression') {
    const callee = unwrap(node.callee);
    if (
      callee.type === 'MemberExpression' &&
      !callee.computed &&
      callee.property.type === 'Identifier' &&
      MUTATORS.has(callee.property.name) &&
      state.has(getRootName(callee.object) ?? '')
    ) {
      effects.unknown = true;
    }
  }
  for (const child of listChildren(node)) {
    findEffects(child, state, effects);
  }
}

/** The paths one function body writes, in source order, or undefined for an unreadable write. */
function listBodyWrites(fn: FunctionNode, state: ReadonlySet<string>): string[] | undefined {
  if (fn.body === null) {
    return [];
  }
  const effects: Effects = { fields: [], unknown: false };
  findEffects(fn.body, state, effects);
  if (effects.unknown) {
    return undefined;
  }
  const params: string[] = [];
  for (const param of fn.params) {
    for (const reference of scanReferences(param)) {
      params.push(reference.name);
    }
  }
  const matched = new Map<number, string[]>();
  findItemWrites(fn.body, matched);
  const paths: string[] = [];
  for (const reference of scanReferences(fn.body, params)) {
    if (!reference.write || !state.has(reference.name)) {
      continue;
    }
    const fields = matched.get(reference.start);
    const found: string[] = [];
    if (fields === undefined) {
      found.push(reference.name);
    } else {
      for (const field of fields) {
        found.push(`${reference.name}.*.${field}`);
      }
    }
    for (const path of found) {
      if (!paths.includes(path)) {
        paths.push(path);
      }
    }
  }
  for (const field of effects.fields) {
    if (!paths.includes(field)) {
      paths.push(field);
    }
  }
  return paths;
}

/** Tells whether one path is a prefix of the other. `*` matches any item, a keyed segment too. */
export function meetsPath(a: string, b: string): boolean {
  const left = a.replaceAll(/\[[^\]]*\]/g, '.*').split('.');
  const right = b.replaceAll(/\[[^\]]*\]/g, '.*').split('.');
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    if (left[index] !== right[index] && left[index] !== '*' && right[index] !== '*') {
      return false;
    }
  }
  return true;
}

/**
 * Returns the paths each handler of a component can change, by handler name. The set holds the
 * handler's own writes and those of every handler it calls. It is an upper bound. A handler with
 * a write the analysis cannot read (in-place mutation, a member update) has no set (undefined).
 */
export function listWrites(
  file: string,
  source: string,
  component: Component,
): Map<string, string[] | undefined> {
  const functions = new Map<string, FunctionNode>();
  const program = parseSync(file, source, { lang: 'tsx' }).program;
  for (const statement of program.body) {
    const declaration =
      (statement.type === 'ExportNamedDeclaration' ||
        statement.type === 'ExportDefaultDeclaration') &&
      statement.declaration !== null
        ? statement.declaration
        : statement;
    if (declaration.type === 'FunctionDeclaration' && declaration.id?.name === component.name) {
      for (const inner of declaration.body?.body ?? []) {
        if (inner.type === 'FunctionDeclaration' && inner.id !== null) {
          functions.set(inner.id.name, inner);
        }
      }
    }
  }
  const state = new Set<string>();
  for (const field of component.state) {
    state.add(field.name);
  }
  const byName = new Map<string, Handler>();
  for (const handler of component.handlers) {
    byName.set(handler.name, handler);
  }
  const out = new Map<string, string[] | undefined>();
  for (const handler of component.handlers) {
    let paths: string[] | undefined = [];
    // The handler, then every handler it calls.
    const closure = [handler];
    for (let index = 0; index < closure.length; index++) {
      const fn = functions.get(closure[index].name);
      const own = fn === undefined ? [] : listBodyWrites(fn, state);
      if (own === undefined) {
        // One unreadable write makes the whole set unknown, which means a full diff.
        paths = undefined;
        break;
      }
      for (const path of own) {
        if (!paths.includes(path)) {
          paths.push(path);
        }
      }
      for (const entry of closure[index].free) {
        const callee = entry.kind === 'handler' ? byName.get(entry.name) : undefined;
        if (callee !== undefined && !closure.includes(callee)) {
          closure.push(callee);
        }
      }
    }
    out.set(handler.name, paths);
  }
  return out;
}
