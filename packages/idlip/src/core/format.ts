/**
 * Internal types shared by the compiler and the runtime. They are not exported
 * from `idlip`. `contracts/compiled-format.md` describes each of them, and the
 * golden fixtures in `test/fixtures/` show them for a counter and a todo app.
 */

/**
 * A message as it travels through the app: a handler's tag and its arguments.
 * It stays plain data, because the server writes it into the HTML.
 */
export interface Message<Tag extends string = string, Payload = unknown> {
  readonly t: Tag;
  readonly p: Payload;
}

/**
 * The JSON value of an `on:<event>` attribute: the tag, the payload and the
 * modifiers, separated by spaces (`"prevent"`, `"key:Escape"`).
 */
export type DomMessage =
  | readonly [tag: string, payload: readonly unknown[]]
  | readonly [tag: string, payload: readonly unknown[], modifiers: string]
  | readonly [tag: string, payload: readonly unknown[], modifiers: string, owner: string];

/**
 * A payload item that the listener replaces when the event fires.
 * `['$', ...items]` is a literal array whose first item starts with `$`.
 */
export type Placeholder =
  | readonly ['$event', ...segments: string[]]
  | readonly ['$', ...items: unknown[]];

/** The state fields of a component, by name. */
export type Model = Readonly<Record<string, unknown>>;

/** The props of a component, or the part of them the client reads. */
export type Props = Readonly<Record<string, unknown>>;

/** What the compiler knows about one module, and what the page carries for it. */
export interface Manifest {
  /** The root-relative Vite id given to `compile`, such as `/src/todo.tsx`. */
  readonly module: string;
  /** Event types the view listens to, sorted. */
  readonly events: readonly string[];
  /**
   * Event type to the names of the handlers that the view dispatches on it, sorted. The server
   * reads it to preload chunks without the markup. Absent when no element dispatches a handler.
   */
  readonly listens?: Readonly<Record<string, readonly string[]>>;
  /** Message tag to its update chunk. Continuation tags have entries too. */
  readonly handlers: Readonly<Record<string, HandlerEntry>>;
  /**
   * Continuation tag to the chunk that runs its awaited call: `task=<tag>`, or the handler's
   * own chunk for a built-in such as `Random.id`, which exports `task$<tag>`. Absent when no
   * handler awaits.
   */
  readonly tasks?: Readonly<Record<string, string>>;
  /** True when a handler returns `after` Dom calls, which the loader runs after the patch. */
  readonly after?: true;
  /**
   * The sources of the `<Subscribe>` blocks of the view, by the name the `i-sub` marker holds.
   * The source of `name` is the chunk `source=<name>`, which exports `source`. Absent when the
   * view has no `<Subscribe>`.
   */
  readonly sources?: readonly string[];
  /**
   * The `<Try>` regions of the view: the region id, as a string, to the chunk `try=<id>`. The
   * chunk exports `render(error, scope)`, the catch view as HTML. Absent when the view has no
   * `<Try>`.
   */
  readonly fallback?: Readonly<Record<string, string>>;
  /** True when the view has a `<Head>`, which the loader serves. Absent otherwise. */
  readonly head?: true;
  /** Binding groups by key, ordered so a group comes before the groups it covers. */
  readonly groups: Readonly<Record<string, BindingGroup>>;
  /** `<For>` blocks by binding id, written as a string. */
  readonly lists: Readonly<Record<string, ListEntry>>;
  /** Present when a project module renders this module as a child. */
  readonly view?: { readonly chunk: string };
}

export interface HandlerEntry {
  readonly chunk: string;
  /** The model paths the handler can change, such as `todos.*.done`. Absent: diff every path. */
  readonly writes?: readonly string[];
  /** The group keys the loader starts with the chunk: groups that meet `writes`, minus covered ones. */
  readonly bindings?: readonly string[];
}

export interface BindingGroup {
  /** The path set shared by the group's bindings, such as `todos.*.done`. */
  readonly paths: readonly string[];
  readonly chunk: string;
  /** Export names of the group's own bindings, such as `a4`. */
  readonly bindings: readonly string[];
  /** Keys of the groups that change whenever this one does. The chunk patches them too. */
  readonly covers: readonly string[];
}

export interface ListEntry {
  /**
   * The field of the item that `key={(item) => item.field}` reads. Absent for a computed key,
   * which the list chunk evaluates with its `key` export.
   */
  readonly key?: string;
  /**
   * The path of `each` when it is a path, such as `todos` or `columns.*.cards`.
   * `diffPaths` also pairs the `*` items under it by `key`. Absent when `each` is a helper call.
   */
  readonly path?: string;
  /** The item template chunk. */
  readonly chunk: string;
  /** Export names of the bindings in a row, not counting rows of nested lists. */
  readonly bindings: readonly string[];
  /** The binding id of the enclosing list, for a nested list. */
  readonly parent?: string;
}

/** The value the state script holds. The client reads it on the first event. */
export interface PageState {
  readonly manifest: Manifest;
  /** Chunk id to URL, for the chunks of the modules rendered on the page. */
  readonly chunks: ChunkUrls;
  readonly model: Model;
  readonly props: Props;
  /** Manifests of the child modules on the page and of what they can render, by module. */
  readonly modules?: Readonly<Record<string, ChildManifest>>;
  /** Rendered children by model path. */
  readonly slots?: Readonly<Record<string, Slot>>;
  /**
   * The model paths each dynamic hole read when it last ran, by binding name. The client keeps
   * the record and replaces an entry each time the hole runs again. Absent when the module has
   * no dynamic hole.
   */
  readonly dynamic?: Record<string, string[]>;
}

/**
 * A child manifest as the state script holds it: without `events` (the record has the union),
 * `listens` (`renderPreload` reads it on the server), `view` and the `writes` of each handler.
 */
export type ChildManifest = Omit<Manifest, 'events' | 'listens' | 'view' | 'handlers'> & {
  readonly handlers: Readonly<Record<string, Omit<HandlerEntry, 'writes'>>>;
};

/** A rendered child: its module, its model and the props the client reads. */
export interface Slot {
  readonly module: string;
  readonly model: Model;
  readonly props: Props;
}

/** Chunk id (`getChunkId`) to the URL the loader imports. */
export type ChunkUrls = Readonly<Record<string, string>>;

/** What a state script pushes: its event types, separated by spaces, and its state. */
export type StateRecord = readonly [events: string, state: () => PageState];

/** An event the listener read, waiting for the loader. */
export interface QueuedEvent {
  readonly message: Message<string, readonly unknown[]>;
  /** The element that carries the `on:<event>` attribute. */
  readonly target: Element;
  readonly type: string;
  readonly latest: boolean;
  /** Item 3 of the message: the model path of the component that owns the handler. */
  readonly owner?: string;
  /** Called once the batch that ran this event has patched, or when the event cannot run. */
  readonly done?: () => void;
  /** An event whose signal is aborted is dropped before it runs. A subscription sets it. */
  readonly signal?: AbortSignal;
}

/** `self.$idlip`: the state records, and the queue the listener fills. */
export interface Boot extends Array<StateRecord> {
  q?: QueuedEvent[];
}

/** The second argument of a compiled server render function. */
export interface RenderContext {
  /** Records the state of the root component. */
  state(state: PageState): void;
  /** Reserves the id of one `<Head>` block. Ids count up in render order, from 0. A host context without head output may leave these out. */
  headId?(): number;
  /**
   * Records what a `<Head>` block writes in `<head>`: `markup` for its elements except the
   * title, and `title` for its `<title>` element. Every element carries `i-head="<id>.<index>"`.
   */
  head?(id: number, markup: string, title?: string): void;
  /** Returns a checkpoint of the head output, so a `<Try>` body that throws can drop its own. */
  headMark?(): number;
  /** Drops the head output recorded after a checkpoint. */
  headRollback?(mark: number): void;
}

/** The default export of a compiled server module. */
export type ServerRender = (props: Props, context: RenderContext, model?: Model) => string;

export interface ServerModule {
  readonly default: ServerRender;
  readonly manifest: Manifest;
  /** The module's chunk URLs. The ids themselves in dev; `vite-plugin` writes built URLs. */
  readonly chunks: ChunkUrls;
}

/** One row of an enclosing `<For>`. */
export interface Row {
  readonly item: unknown;
  readonly index: number;
}

/** What a binding or a template reads. `rows` lists enclosing rows, outermost first. */
export interface Scope {
  readonly model: Model;
  readonly props: Props;
  readonly rows: readonly Row[];
  /** The model path of the component the binding belongs to. Absent means the root. */
  readonly path?: string;
  /** The paths dynamic holes read, by binding name. Only the root has them. */
  readonly dynamic?: Record<string, string[]>;
}

/** An `a<id>`, `t<id>` or `c<id>` export: patches the node it is given. */
export type NodeBinding = (node: Node, scope: Scope) => void;

/** An `l<id>` export: returns the list of a `<For>` block. */
export type ListBinding = (scope: Scope) => readonly unknown[];

/** A `p<id>` export: has no node. It passes a prop to a slot by path. */
export type PropBinding = (scope: Scope) => void;

export type Binding = NodeBinding | ListBinding | PropBinding;

/** The `view` chunk of a child module. */
export interface ViewChunk {
  /** The initial model from the state initializers and the props. */
  readonly init: (props: Props) => Model;
  /** The whole view, without the boundary markers. */
  readonly render: (scope: Scope) => string;
}

/** A handler export: the next model, or the next model and a task. */
export type Update = (model: Model, payload: readonly unknown[]) => Model | Step;

export interface Step {
  /** Marks a step, since a model may have a field named `model` or `task`. */
  readonly $step?: true;
  readonly model: Model;
  readonly task?: Task;
  /** Dom calls that run once after the batch's patch. */
  readonly after?: readonly After[];
}

/** A `Dom.focus`, `Dom.scrollIntoView` or `Dom.reset` call of a handler, run after the patch. */
export interface After {
  readonly call: 'focus' | 'scrollIntoView' | 'reset';
  /** The ref name: a string, or `[name, key]` for a row. */
  readonly args: readonly [string | readonly [string, string | number]];
}

/** An awaited call, run by `runTask`. */
export interface Task {
  /** The awaited call site: the continuation tag, such as `persist$1`. A key of `manifest.tasks`. */
  readonly site: string;
  readonly args: readonly unknown[];
  /** The continuation tag, such as `persist$1`. */
  readonly then: string;
  /** Locals read after the `await` in the order of `segments[n].carried`, then props values. */
  readonly carried: readonly unknown[];
}

/** The first payload item of a continuation message. */
export type Outcome =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: unknown };

export type HandlerChunk = Readonly<Record<string, Update>>;

export type BindingChunk = Readonly<Record<string, Binding>>;

export interface ListChunk {
  /**
   * Renders one row: its HTML without the row markers, or a fragment cloned from a template in
   * `doc`, with the row markers.
   */
  readonly render: (scope: Scope, doc: Document) => string | DocumentFragment;
  /** The key of an item, for a list whose manifest entry has no `key` field. */
  readonly key?: (item: unknown) => unknown;
  readonly namespace?: 'svg' | 'mathml';
}

/** Loads a chunk of a module: imports the URL the state record gives for its id. */
export type LoadChunk = (module: string, chunk: string) => Promise<unknown>;

/** A rendered root component on the client. */
export interface Page {
  /** The parent node of the state script. */
  readonly root: ParentNode;
  readonly manifest: Manifest;
  readonly props: Props;
  readonly load: LoadChunk;
  /** The model path of a child. Absent for the root. */
  readonly path?: string;
  /** The boundary start of a child: its bindings are looked up between it and its end. */
  readonly start?: Comment;
  /** The state record's `dynamic`. Only the root has it. */
  readonly dynamic?: Record<string, string[]>;
}

/** Owned by `patch-bindings`. The loader awaits it before the next queued message. */
export type Patch = (page: Page, prev: Model, next: Model) => Promise<void>;

/**
 * Owned by `patch-bindings`. Returns the paths whose values differ by reference.
 * `keys` maps a list path (`ListEntry.path`) to its key field, or to `undefined` for a computed
 * key, under which any change of the list counts as a change of its `*` paths. A `*` path under such a list
 * changes when it differs by key or by index: by key for row bindings after a reorder, by
 * index for holes outside rows such as `todos[selected].done`.
 */
export type DiffPaths = (
  prev: Model,
  next: Model,
  paths: readonly string[],
  keys: Readonly<Record<string, string | undefined>>,
) => Set<string>;

export interface ListContext {
  readonly page: Page;
  readonly list: ListEntry;
  /** The scopes around the list block. */
  readonly prev: Scope;
  readonly next: Scope;
  /**
   * The row bindings of this list that this patch runs, by export name. An `l` entry is a
   * nested list: for a kept row whose item changed, `patchList` calls itself on it.
   */
  readonly bindings: ReadonlyMap<string, Binding>;
}

/** Implemented by `patch-lists`, called from `patch()`. */
export type PatchList = (
  start: Comment,
  prev: readonly unknown[],
  next: readonly unknown[],
  context: ListContext,
) => Promise<void>;

/** Owned by `patch-bindings`: registers code that runs when a block is added or removed. */
export type OnBlock = (add: (start: Comment) => void, remove: (start: Comment) => void) => void;

/** A client module the compiler emits. */
export interface Module {
  /** The chunk name, such as `handler=toggle` or `binding=todos.*.done`. */
  readonly chunk: string;
  readonly code: string;
}

export interface CompileDiagnostic {
  readonly rule: string;
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly span: { readonly start: number; readonly end: number };
}

/** The manifest and client chunks of one component of a file. */
export interface CompiledComponent {
  readonly manifest: Manifest;
  readonly client: readonly Module[];
}

export interface CompileResult {
  /** The server module's code, for every component of the file. Empty on an error. */
  readonly server: string;
  /** The chunks of the first component: the default export, or the first named one. */
  readonly client: readonly Module[];
  readonly manifest: Manifest;
  /** The other components of the file, in source order. Absent when there are none. */
  readonly components?: readonly CompiledComponent[];
  readonly diagnostics: readonly CompileDiagnostic[];
}

/** Returns every component of a compile result, the first one first. */
export function listCompiled(result: CompileResult): CompiledComponent[] {
  return [{ manifest: result.manifest, client: result.client }, ...(result.components ?? [])];
}

/** The `#<Name>` at the end of the module id of a component other than the default export. */
const COMPONENT_SUFFIX = /#([A-Z][^#?/.]*)$/;

/**
 * Splits a module id into its file and the name of the component. The default export of a
 * file has the file's id, `/src/todo.tsx`. Any other component adds `#` and its name,
 * `/src/widgets.tsx#Counter`.
 */
export function splitModule(module: string): { file: string; name: string | undefined } {
  // Only a final `#` and a capitalized name with no `/`, `.` or `?` names a component, so a
  // folder such as `/src/a#b/` stays part of the file.
  const match = COMPONENT_SUFFIX.exec(module);
  return match === null
    ? { file: module, name: undefined }
    : { file: module.slice(0, match.index), name: match[1] };
}

/** `idlip/compiler`. */
export type Compile = (source: string, id: string) => CompileResult;

/**
 * Returns the file name of a chunk: `binding=todos.*.done` is `binding.todos._.done.js`. The
 * first `=` separates the kind. A keyed segment keeps URL-safe characters: `[` is `(`, `]` is `)`
 * and the `=` inside is `~`, so `binding=todos[id=selected].text` is
 * `binding.todos(id~selected).text.js`. The fixtures use it, and so does the Vite plugin for the
 * `name` of an emitted chunk.
 */
export function getChunkFile(chunk: string): string {
  const at = chunk.indexOf('=');
  const kind = at === -1 ? chunk : `${chunk.slice(0, at)}.${chunk.slice(at + 1)}`;
  const text = kind.replaceAll('=', '~').replaceAll('[', '(').replaceAll(']', ')');
  return `${text.replaceAll('*', '_').replaceAll(',', '+')}.js`;
}

/**
 * Returns the Vite module id of a chunk: `/src/todo.tsx?idlip-handler=toggle&lang.js`. A named
 * component puts its name before the chunk: `/src/widgets.tsx?idlip-Counter.handler=add&lang.js`
 * for the module `/src/widgets.tsx#Counter`.
 */
export function getChunkId(module: string, chunk: string): string {
  // The name is a capital letter and no `#`, `?`, `/` or `.`, as in `splitModule`, so a `#` in a
  // folder or file name stays. The replace costs the loader less than a branch.
  return `${module}?idlip-${chunk}&lang.js`.replace(/#([A-Z][^#?/.]*)\?idlip-/, '?idlip-$1.');
}
