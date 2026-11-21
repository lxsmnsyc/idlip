import { Feature, serialize } from 'seroval';
import type { PageState, RenderContext } from '../core/format.ts';
import { attr } from './helpers.ts';

export interface RenderOptions {
  /** Written on the state script. */
  nonce?: string;
}

// Keeps an `Error` in the model from writing its stack, which holds server paths.
const SEROVAL_OPTIONS = { disabledFeatures: Feature.ErrorPrototypeStack };

function escapeScript(value: string): string {
  const line = String.fromCodePoint(0x2028);
  const paragraph = String.fromCodePoint(0x2029);
  return value
    .replaceAll('<', String.raw`\x3C`)
    .replaceAll(line, String.raw` `)
    .replaceAll(paragraph, String.raw` `);
}

function canSerialize(value: unknown): boolean {
  try {
    serialize(value, SEROVAL_OPTIONS);
    return true;
  } catch {
    return false;
  }
}

function joinPath(prefix: string, segment: string): string {
  return prefix === '' ? segment : `${prefix}.${segment}`;
}

/**
 * Returns the path of the innermost value that does not serialize, or undefined.
 */
function findBadPath(value: unknown, path: string, seen: Set<object>): string | undefined {
  if (canSerialize(value)) {
    return undefined;
  }
  if (typeof value === 'object' && value !== null && !seen.has(value)) {
    seen.add(value);
    const proto: unknown = Object.getPrototypeOf(value);
    if (Array.isArray(value) || proto === Object.prototype || proto === null) {
      for (const [field, child] of Object.entries(value)) {
        const found = findBadPath(child, joinPath(path, field), seen);
        if (found !== undefined) {
          return found;
        }
      }
    }
  }
  return path;
}

function serializeState(state: PageState): string {
  try {
    return serialize(
      { manifest: state.manifest, chunks: state.chunks, model: state.model, props: state.props },
      SEROVAL_OPTIONS,
    );
  } catch (error) {
    // Walk the values to name the path, which seroval's error does not carry.
    const seen = new Set<object>();
    const bad = findBadPath(state.model, 'model', seen) ?? findBadPath(state.props, 'props', seen);
    if (bad === undefined) {
      throw error;
    }
    throw new TypeError(`The value at \`${bad}\` does not serialize into the page state`, {
      cause: error,
    });
  }
}

function writeState(state: PageState, nonce: string | undefined): string {
  const events = escapeScript(JSON.stringify(state.manifest.events.join(' ')));
  // seroval's output is a parenthesized expression, so it serves as the arrow body as it is.
  // It writes `<` as `\x3C` and escapes U+2028 and U+2029, so a value cannot end the script.
  const body = serializeState(state);
  const script = `(self.$idlip||=[]).push([${events},()=>${body}])`;
  return `<script i-state${attr('nonce', nonce)}>${script}</script>`;
}

function renderSync(component: (props: never) => unknown, props: unknown, nonce?: string): string {
  let recorded: PageState | undefined;
  const context: RenderContext = {
    state(state) {
      if (recorded !== undefined) {
        throw new Error('The component recorded its state twice');
      }
      recorded = state;
    },
  };
  // The compiled server module takes the render context as its second argument.
  const markup: unknown = Reflect.apply(component, undefined, [props, context]);
  if (typeof markup !== 'string') {
    throw new TypeError(
      'The component did not return markup. Pass the default export of a compiled module',
    );
  }
  if (recorded === undefined) {
    throw new Error(
      'The component recorded no state. Pass the default export of a compiled module',
    );
  }
  return markup + writeState(recorded, nonce);
}

/**
 * Renders a compiled component to HTML: its markup, then its state script.
 */
// A promise executor turns a thrown error into a rejection without an `await`.
// oxlint-disable-next-line typescript/promise-function-async
export function render<P>(
  component: (props: P) => unknown,
  props: P,
  options: RenderOptions = {},
): Promise<string> {
  return new Promise((resolve) => {
    resolve(renderSync(component, props, options.nonce));
  });
}
