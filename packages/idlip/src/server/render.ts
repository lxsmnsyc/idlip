import { Feature, serialize } from 'seroval';
import type { ChunkUrls, Manifest, Model, PageState, Props } from '../core/format.ts';
import { DEV } from '../core/dev.ts';
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

/** A rendered child: its module, its model and the props the client reads. */
interface Slot {
  readonly module: string;
  readonly model: Model;
  readonly props: Props;
}

/** A compiled server module, as far as the render needs it. */
interface ModuleInfo {
  readonly manifest: Manifest;
  readonly chunks: ChunkUrls;
  readonly uses?: readonly ModuleInfo[];
}

/** What a component records: its state, and the server modules of the children it can render. */
interface ComponentState extends PageState {
  readonly uses?: readonly ModuleInfo[];
}

/** `RenderContext` with the nesting additions of compiled-format v10. */
interface NestedContext {
  state(state: ComponentState, path?: string): void;
  headId(): number;
  head(id: number, markup: string, title?: string): void;
  headMark(): number;
  headRollback(mark: number): void;
}

/** What `renderPage` returns: the markup for `<head>`, and the body markup with the state script. */
export interface RenderResult {
  /** The elements of every `<Head>`. The title of the last block is first. */
  head: string;
  body: string;
}

/** What the state script holds: the root's state, the child manifests and the slots. */
interface RecordedState extends PageState {
  readonly modules?: Readonly<Record<string, Manifest>>;
  readonly slots?: Readonly<Record<string, Slot>>;
  /** The event types of the root and of every module in `modules`. */
  readonly events: readonly string[];
  /** The build id the plugin put in the chunk map. The state script carries it as `i-build`. */
  readonly build?: string;
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

function serializeState(state: RecordedState): string {
  const record: Record<string, unknown> = {
    manifest: state.manifest,
    chunks: state.chunks,
    model: state.model,
    props: state.props,
  };
  if (state.modules !== undefined) {
    record.modules = state.modules;
  }
  if (state.slots !== undefined) {
    record.slots = state.slots;
  }
  if (state.dynamic !== undefined) {
    record.dynamic = state.dynamic;
  }
  try {
    return serialize(record, SEROVAL_OPTIONS);
  } catch (error) {
    // Walk the values to name the path, which seroval's error does not carry.
    const seen = new Set<object>();
    let bad = findBadPath(state.model, 'model', seen) ?? findBadPath(state.props, 'props', seen);
    for (const [path, slot] of Object.entries(state.slots ?? {})) {
      bad ??=
        findBadPath(slot.model, `slots.${path}.model`, seen) ??
        findBadPath(slot.props, `slots.${path}.props`, seen);
    }
    if (bad === undefined) {
      throw error;
    }
    throw new TypeError(`The value at \`${bad}\` does not serialize into the page state`, {
      cause: error,
    });
  }
}

function writeState(state: RecordedState, nonce: string | undefined): string {
  const events = escapeScript(JSON.stringify(state.events.join(' ')));
  // seroval's output is a parenthesized expression, so it serves as the arrow body as it is.
  // It writes `<` as `\x3C` and escapes U+2028 and U+2029, so a value cannot end the script.
  const body = serializeState(state);
  const script = `(self.$idlip||=[]).push([${events},()=>${body}])`;
  return `<script i-state${attr('i-build', state.build)}${attr('nonce', nonce)}>${script}</script>`;
}

/** Adds the manifest and chunk URLs of the modules a component can render, and their children. */
function collectModules(
  uses: readonly ModuleInfo[],
  modules: Map<string, Manifest>,
  chunks: Record<string, string>,
): void {
  for (const info of uses) {
    if (!modules.has(info.manifest.module)) {
      modules.set(info.manifest.module, info.manifest);
      Object.assign(chunks, info.chunks);
      collectModules(info.uses ?? [], modules, chunks);
    }
  }
}

/**
 * Puts the calls of one render together. The call without a path is the root's. A call with a
 * path is a child's: it becomes a slot, and its module joins `modules`. The chunk URLs and the
 * event types of every module on the page join the root's.
 */
function mergeState(root: ComponentState, children: Map<string, ComponentState>): RecordedState {
  const modules = new Map<string, Manifest>();
  const chunks: Record<string, string> = {};
  const slots = new Map<string, Slot>();
  collectModules(root.uses ?? [], modules, chunks);
  for (const [path, state] of children) {
    slots.set(path, { module: state.manifest.module, model: state.model, props: state.props });
    collectModules([state], modules, chunks);
  }
  const events = new Set(root.manifest.events);
  for (const manifest of modules.values()) {
    for (const event of manifest.events) {
      events.add(event);
    }
  }
  const merged = { ...root.chunks, ...chunks };
  const { build, ...urls } = merged;
  return {
    manifest: root.manifest,
    chunks: urls,
    ...(Object.hasOwn(merged, 'build') ? { build } : {}),
    model: root.model,
    props: root.props,
    ...(root.dynamic === undefined ? {} : { dynamic: root.dynamic }),
    ...(modules.size === 0 ? {} : { modules: Object.fromEntries(modules) }),
    ...(slots.size === 0 ? {} : { slots: Object.fromEntries(slots) }),
    events: [...events].toSorted(),
  };
}

function renderSync(
  component: (props: never) => unknown,
  props: unknown,
  nonce?: string,
): RenderResult {
  let root: ComponentState | undefined;
  let heads = 0;
  const entries: { id: number; markup: string; title: string | undefined }[] = [];
  const children = new Map<string, ComponentState>();
  const context: NestedContext = {
    headId() {
      return heads++;
    },
    head(id, markup, title) {
      entries.push({ id, markup, title });
    },
    headMark() {
      return entries.length;
    },
    headRollback(mark) {
      entries.length = mark;
    },
    state(state, path) {
      // The root has no path, or the empty one.
      if (path === undefined || path === '') {
        if (root !== undefined) {
          throw new Error('The component recorded its state twice');
        }
        root = state;
      } else {
        if (children.has(path)) {
          throw new Error(`The component at \`${path}\` recorded its state twice`);
        }
        children.set(path, state);
      }
    },
  };
  // The compiled server module takes the render context as its second argument.
  const markup: unknown = Reflect.apply(component, undefined, [props, context]);
  if (typeof markup !== 'string') {
    throw new TypeError(
      'The component did not return markup. Pass the default export of a compiled module',
    );
  }
  if (root === undefined) {
    throw new Error(
      'The component recorded no state. Pass the default export of a compiled module',
    );
  }
  // The last title goes first, since a reader without scripts takes the first one.
  const titles: string[] = [];
  const head: string[] = [];
  // Ids follow the order of the markup, which a `<Try>` body breaks for the calls.
  entries.sort((a, b) => a.id - b.id);
  for (const entry of entries) {
    head.push(entry.markup);
    if (entry.title !== undefined) {
      titles.push(entry.title);
    }
  }
  // The last title is the one that wins, so it goes first. The others follow, for the client.
  head.unshift(...titles.slice(-1), ...titles.slice(0, -1));
  return { head: head.join(''), body: markup + writeState(mergeState(root, children), nonce) };
}

/**
 * Renders a compiled component to HTML: its markup, then its state script. The elements of a
 * `<Head>` are not in the result: use `renderPage` to get them.
 */
// A promise executor turns a thrown error into a rejection without an `await`.
// oxlint-disable-next-line typescript/promise-function-async
export function render<P>(
  component: (props: P) => unknown,
  props: P,
  options: RenderOptions = {},
): Promise<string> {
  return new Promise((resolve) => {
    const { head, body } = renderSync(component, props, options.nonce);
    if (DEV && head !== '') {
      // oxlint-disable-next-line no-console
      console.warn('idlip: render() drops the <Head> output of the page. Use renderPage().');
    }
    resolve(body);
  });
}

/**
 * Renders a compiled component and returns the markup for `<head>` next to the body markup.
 * The host writes `head` inside `<head>` and `body` in `<body>`.
 */
// oxlint-disable-next-line typescript/promise-function-async
export function renderPage<P>(
  component: (props: P) => unknown,
  props: P,
  options: RenderOptions = {},
): Promise<RenderResult> {
  return new Promise((resolve) => {
    resolve(renderSync(component, props, options.nonce));
  });
}
