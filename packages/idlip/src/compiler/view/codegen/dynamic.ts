// Prints dynamic holes: a hole whose model reads the server and the client record when they run
// it (`track$` in `server/dynamic.ts`). The server module calls the helper from `idlip/server`.
// A client chunk gets a copy, and reads the model and the record of paths from its scope.
import type { Component, Hole } from '../analyze/index.ts';
import type { Emitter } from './expr.ts';
import { getKey, getLocalName, quote } from './text.ts';

/** The name of the record of paths in the server module. */
export const DYNAMIC_STORE = 'dynamic$';

/** The key of the manifest group that holds the dynamic holes. */
export const DYNAMIC_GROUP = '$dynamic';

/** Prints the model of the component as an object, from the local names of the server module. */
function printServerModel(component: Component): string {
  const fields: string[] = [];
  for (const field of component.state) {
    const local = getLocalName(field.name);
    fields.push(local === field.name ? local : `${getKey(field.name)}: ${local}`);
  }
  return fields.length === 0 ? '{}' : `{ ${fields.join(', ')} }`;
}

/**
 * Prints `track$(store, name, model, (model) => value)`. The value reads state through `model`
 * in both places, so the proxy sees every read.
 */
export function printTracked(
  emitter: Emitter,
  component: Component,
  hole: Hole,
  name: string,
): string {
  emitter.usage.helpers.add('track');
  emitter.tracked = true;
  const value = emitter.expr(hole.expr, 1);
  emitter.tracked = false;
  if (emitter.mode === 'server') {
    return `track$(${DYNAMIC_STORE}, ${quote(name)}, ${printServerModel(component)}, (model) => ${value})`;
  }
  emitter.usage.scope.add('dynamic');
  emitter.usage.scope.add('model');
  return `track$(dynamic, ${quote(name)}, model, (model) => ${value})`;
}
