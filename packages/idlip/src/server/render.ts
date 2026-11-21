import { Feature, serialize } from 'seroval';
import { getChunkId } from '../core/format.ts';
import type {
  ChildManifest,
  ChunkUrls,
  HandlerEntry,
  Manifest,
  Model,
  PageState,
  Props,
} from '../core/format.ts';
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

/** The slots a render recorded, by path. */
type Slots = Record<string, Slot>;

/**
 * What a root module adds to its state script whatever the render: the manifest and chunk URLs
 * (`head`), the child manifests (`tail`) and the event types. `head` and `tail` are the inside
 * of seroval's `({…})` output, ready to join with the model. They are rebuilt only when the
 * module, its chunk map or its `uses` change.
 */
interface StaticPart {
  readonly chunks: ChunkUrls;
  readonly uses: readonly ModuleInfo[] | undefined;
  /** Every child module the part holds, by module id, to check the children of a render. */
  readonly known: ReadonlyMap<string, ModuleInfo>;
  /** The first element of the pushed array: the event types, as a string literal. */
  readonly events: string;
  /** The build id the plugin put in the chunk map. The state script carries it as `i-build`. */
  readonly build: string | undefined;
  /** The chunk URLs of the state, without `build`. */
  readonly urls: Record<string, string>;
  /** The manifests of the child modules. */
  readonly modules: ReadonlyMap<string, Manifest>;
  /** `manifest` and `chunks` as seroval wrote them, without the braces. Undefined if not plain. */
  readonly head: string | undefined;
  /** `modules` as seroval wrote it, without the braces. Empty when there are none. */
  readonly tail: string | undefined;
}

const PARTS = new WeakMap<Manifest, StaticPart>();

const CLIENT_MANIFESTS = new WeakMap<Manifest, ChildManifest>();

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

/** Serializes the values of one render, and names the path of the one that does not serialize. */
function serializeValues(
  record: Record<string, unknown>,
  state: ComponentState,
  slots?: Slots,
): string {
  try {
    return serialize(record, SEROVAL_OPTIONS);
  } catch (error) {
    // Walk the values to name the path, which seroval's error does not carry.
    const seen = new Set<object>();
    let bad = findBadPath(state.model, 'model', seen) ?? findBadPath(state.props, 'props', seen);
    for (const [path, slot] of Object.entries(slots ?? {})) {
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

/** Returns the inside of a plain object literal `({…})` as seroval writes it, else undefined. */
function openPlain(code: string): string | undefined {
  return code.startsWith('({') && code.endsWith('})') ? code.slice(2, -2) : undefined;
}

/**
 * Drops from a child manifest what the loader never reads: `events` (the record holds the
 * union), `listens` (`renderPreload` reads it on the server), the `writes` of each handler and
 * `view` (a template chunk imports the view chunk by id). The root manifest is written whole.
 */
function toChildManifest(manifest: Manifest): ChildManifest {
  let client = CLIENT_MANIFESTS.get(manifest);
  if (client === undefined) {
    const { events: _events, listens: _listens, view: _view, handlers, ...rest } = manifest;
    const slim: Record<string, HandlerEntry> = {};
    for (const [tag, entry] of Object.entries(handlers)) {
      const { writes: _writes, ...kept } = entry;
      slim[tag] = kept;
    }
    client = { ...rest, handlers: slim };
    CLIENT_MANIFESTS.set(manifest, client);
  }
  return client;
}

/** The child manifests as the state script holds them, by module. */
function toClientModules(modules: ReadonlyMap<string, Manifest>): Record<string, ChildManifest> {
  const out: Record<string, ChildManifest> = {};
  for (const [module, manifest] of modules) {
    out[module] = toChildManifest(manifest);
  }
  return out;
}

/**
 * Adds the manifest and chunk URLs of the modules a component can render, and their children.
 * The view chunk of a child is left out of `chunks`: nothing loads it by URL.
 */
function collectModules(
  uses: readonly ModuleInfo[],
  modules: Map<string, Manifest>,
  chunks: Record<string, string>,
  known: Map<string, ModuleInfo>,
): void {
  for (const info of uses) {
    const { module, view } = info.manifest;
    if (!modules.has(module)) {
      modules.set(module, info.manifest);
      known.set(module, info);
      const viewId = view === undefined ? undefined : getChunkId(module, view.chunk);
      for (const [id, url] of Object.entries(info.chunks)) {
        if (id !== viewId) {
          chunks[id] = url;
        }
      }
      collectModules(info.uses ?? [], modules, chunks, known);
    }
  }
}

/** Builds what the state script of a root module holds whatever the render. */
function buildPart(root: ComponentState, children: Iterable<ComponentState> = []): StaticPart {
  const modules = new Map<string, Manifest>();
  const known = new Map<string, ModuleInfo>();
  const urls: Record<string, string> = Object.assign({}, root.chunks);
  collectModules(root.uses ?? [], modules, urls, known);
  // Children outside `uses` join this render's part only.
  for (const state of children) {
    collectModules([state], modules, urls, known);
  }
  const events = new Set(root.manifest.events);
  for (const manifest of modules.values()) {
    for (const event of manifest.events) {
      events.add(event);
    }
  }
  // The build id is not in the state's `chunks`: it is the `i-build` attribute.
  const build = Object.hasOwn(urls, 'build') ? urls.build : undefined;
  delete urls.build;
  const tail =
    modules.size === 0
      ? ''
      : openPlain(serialize({ modules: toClientModules(modules) }, SEROVAL_OPTIONS));
  return {
    chunks: root.chunks,
    uses: root.uses,
    known,
    events: escapeScript(JSON.stringify([...events].toSorted().join(' '))),
    build,
    urls,
    modules,
    head: openPlain(serialize({ manifest: root.manifest, chunks: urls }, SEROVAL_OPTIONS)),
    tail,
  };
}

/** Whether every child of a render is a module the part holds, with the same module data. */
function holds(part: StaticPart, children: Map<string, ComponentState>): boolean {
  for (const state of children.values()) {
    const info = part.known.get(state.manifest.module);
    if (
      info === undefined ||
      info.manifest !== state.manifest ||
      info.chunks !== state.chunks ||
      info.uses !== state.uses
    ) {
      return false;
    }
  }
  return true;
}

/** Returns the static part of a render, kept from the last one when the module data is the same. */
function getPart(root: ComponentState, children: Map<string, ComponentState>): StaticPart {
  let kept = PARTS.get(root.manifest);
  if (kept === undefined || kept.chunks !== root.chunks || kept.uses !== root.uses) {
    // The kept part comes from `uses` alone, so no render's children leak into the next one.
    kept = buildPart(root);
    PARTS.set(root.manifest, kept);
  }
  // A child outside `uses` builds a part for this render only.
  return holds(kept, children) ? kept : buildPart(root, children.values());
}

/**
 * Writes the state script. The call without a path is the root's. A call with a path is a
 * child's: it becomes a slot, and its module joins `modules`. The manifests, chunk URLs and
 * event types are the same on each render of a module, so they are serialized once and kept.
 * Only the model, props, slots and dynamic holes go through seroval on each render.
 */
function writeState(
  root: ComponentState,
  children: Map<string, ComponentState>,
  nonce: string | undefined,
): string {
  const part = getPart(root, children);
  const values: Record<string, unknown> = { model: root.model, props: root.props };
  let slots: Slots | undefined;
  if (children.size !== 0) {
    slots = {};
    for (const [path, state] of children) {
      slots[path] = { module: state.manifest.module, model: state.model, props: state.props };
    }
    values.slots = slots;
  }
  if (root.dynamic !== undefined) {
    values.dynamic = root.dynamic;
  }
  // seroval writes `<` as `\x3C` and escapes U+2028 and U+2029, so a value cannot end the script.
  const inner = openPlain(serializeValues(values, root, slots));
  let body: string;
  if (part.head !== undefined && part.tail !== undefined && inner !== undefined) {
    // seroval's output is a parenthesized expression, so it serves as the arrow body as it is.
    // The parts share no value, so they join as one object literal.
    const tail = part.tail === '' ? '' : `,${part.tail}`;
    body = `({${part.head},${inner}${tail}})`;
  } else {
    // A value that seroval shares or cycles makes it write a function: serialize it all at once.
    const record: Record<string, unknown> = {
      manifest: root.manifest,
      chunks: part.urls,
      ...values,
    };
    if (part.modules.size !== 0) {
      record.modules = toClientModules(part.modules);
    }
    body = serializeValues(record, root, slots);
  }
  const script = `(self.$idlip||=[]).push([${part.events},()=>${body}])`;
  return `<script i-state${attr('i-build', part.build)}${attr('nonce', nonce)}>${script}</script>`;
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
  return { head: head.join(''), body: markup + writeState(root, children, nonce) };
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
