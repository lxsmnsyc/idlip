// The view IR, as frozen in docs/roadmaps/core/contracts/view-ir.md (v8).

import type { UrlKind } from '../../../core/url.ts';

/** A source range: byte offsets into the file. */
export interface Span {
  start: number;
  end: number;
}

/**
 * One segment of a path. A string is a field name. `item` is any element of a list or any
 * value of a record, printed `*`; it appears in path sets only. `index` is a computed access
 * (`labels[filter]`) in an expression; in the path set it becomes `*` plus the key's paths.
 * `keyed` is `list.find((t) => t.field === value)`: the item whose `field` equals `value`.
 * A path set keeps it only for a list whose `<For>` has that `key` and a state path as value.
 * Otherwise it becomes `*`, plus a path to the field.
 */
export type Segment =
  | string
  | { kind: 'item' }
  | { kind: 'index'; value: Expr }
  | { kind: 'keyed'; field: string; value: Expr };

/**
 * Where a path starts. `state` and `props` are model paths: they are what bindings subscribe
 * to. `loop`, `event` and `local` paths are resolved against a loop row, a DOM event or a
 * `<Try>` catch parameter and never appear in a path set. `global` is a pure
 * global from the allow-list (`String`, `Math.max`).
 */
export type Root =
  | { kind: 'state'; name: string }
  | { kind: 'props' }
  | { kind: 'loop'; name: string; index: boolean }
  | { kind: 'event' }
  | { kind: 'local'; name: string }
  | { kind: 'global'; name: string }
  | { kind: 'import'; name: string; source: string }
  | { kind: 'module'; name: string };

/** A model path, as a binding subscribes to it. */
export interface Path {
  root: 'state' | 'props';
  segments: Segment[];
}

/** An expression in the closed grammar, with derived values and stateless components inlined. */
export type Expr =
  | { kind: 'literal'; value: string | number | boolean | null | undefined }
  | { kind: 'path'; root: Root; segments: Segment[]; optional: boolean }
  | { kind: 'unary'; op: UnaryOp; arg: Expr }
  | { kind: 'binary'; op: BinaryOp; left: Expr; right: Expr }
  | { kind: 'logical'; op: '&&' | '||' | '??'; left: Expr; right: Expr }
  | { kind: 'conditional'; test: Expr; then: Expr; else: Expr }
  | { kind: 'template'; quasis: string[]; exprs: Expr[] }
  | { kind: 'object'; entries: { key: string; value: Expr }[] }
  | { kind: 'array'; items: Expr[] }
  | { kind: 'call'; callee: Root; args: Expr[]; helper: 'args'; impure?: true }
  | { kind: 'call'; callee: Root; args: Expr[]; helper: 'inlined'; body: Expr }
  | { kind: 'method'; receiver: Expr; name: Method; args: Expr[] }
  | { kind: 'property'; receiver: Expr; name: 'length' };

export type UnaryOp = '!' | '-' | '+' | 'typeof';

export type BinaryOp =
  | '==='
  | '!=='
  | '=='
  | '!='
  | '<'
  | '<='
  | '>'
  | '>='
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '**';

/** Non-mutating methods allowed on any value in a hole. Their paths are the receiver's and the arguments'. */
export type Method =
  | 'trim'
  | 'toUpperCase'
  | 'toLowerCase'
  | 'slice'
  | 'includes'
  | 'startsWith'
  | 'endsWith'
  | 'indexOf'
  | 'join'
  | 'at'
  | 'padStart'
  | 'padEnd'
  | 'toFixed';

/**
 * A hole: one expression the view reads, with its path set. `paths` is `dynamic` when the
 * analysis cannot resolve it. No construct in the closed grammar produces `dynamic`.
 */
export interface Hole {
  id: number;
  expr: Expr;
  paths: Path[] | 'dynamic';
  /**
   * The static paths of a `dynamic` hole, the coarse set the analysis can name. Code generation
   * binds the hole with them where it cannot track reads: in rows, blocks and children.
   */
  fallback?: Path[];
  span: Span;
}

/**
 * The key of a `<For>` row, from `key={(item) => ...}`. A `field` is a field of the item
 * (`item.id`) and the manifest names it. A `computed` key is any other expression of the item
 * in the closed grammar; the list chunk evaluates it.
 */
export type ForKey = { kind: 'field'; field: string } | { kind: 'computed'; expr: Expr };

/** What an event prop dispatches. */
export type Target =
  | { kind: 'handler'; name: string }
  | { kind: 'prop'; name: string }
  | { kind: 'reset' };

/**
 * One step of an event arrow, run when the event dispatches: a handler call, or a branch on a
 * test. The expressions read the event (`root.kind === 'event'`), the model, the props and
 * the row scope.
 */
export type EventStep =
  | { kind: 'send'; target: Target; args: Expr[]; span: Span }
  | { kind: 'if'; test: Expr; then: EventStep[]; else: EventStep[] };

/**
 * What an event does. `steps` compile to a function in the handler chunk that returns the
 * messages (`event-callbacks`). `message` is data built at render: a message prop of a stateful
 * child, a forwarded message prop and a `<Try>` reset.
 */
export type EventBody =
  | { kind: 'steps'; steps: EventStep[] }
  | { kind: 'message'; target: Target; args: Expr[]; paths: Path[] };

/** `on:click={...}` or `latest:pointermove={...}`, and message props on child components. */
export interface Event {
  name: string;
  mode: 'on' | 'latest';
  body: EventBody;
  /** `prevent`, `stop` and key filters, from the block body forms of view-ir v9. */
  modifiers: EventModifier[];
  span: Span;
}

/** `prevent` with `keys` prevents the events that match one of the key filters only. */
export type EventModifier =
  | { kind: 'prevent'; keys?: string[] }
  | { kind: 'stop' }
  | { kind: 'once' }
  | { kind: 'capture' }
  | { kind: 'passive' }
  | { kind: 'key'; filter: string };

export type AttrValue = { kind: 'static'; value: string | true } | { kind: 'hole'; hole: Hole };

export interface Attr {
  name: string;
  value: AttrValue;
  /** How a bound value is checked as a URL, from `getUrlKind`. */
  url?: UrlKind;
}

export type Namespace = 'html' | 'svg' | 'mathml';

export type Ref = { kind: 'name'; name: string } | { kind: 'tuple'; name: string; key: Expr };

export type Slot =
  | { kind: 'key'; hole: Hole }
  | { kind: 'for-key' }
  | { kind: 'position'; index: number };

export type Node =
  | { kind: 'text'; value: string }
  | { kind: 'text-hole'; hole: Hole }
  | {
      kind: 'element';
      tag: string;
      namespace: Namespace;
      attrs: Attr[];
      events: Event[];
      ref: Ref | undefined;
      html: Hole | undefined;
      children: Node[];
      span: Span;
    }
  | {
      kind: 'for';
      each: Hole;
      key: ForKey;
      item: string;
      index: string | undefined;
      namespace: Namespace;
      body: Node[];
    }
  | { kind: 'condition'; test: Hole; then: Node[]; else: Node[]; namespace: Namespace }
  | {
      kind: 'try';
      body: Node[];
      error: string;
      reset: string | undefined;
      catch: Node[];
      namespace: Namespace;
    }
  | { kind: 'head'; children: Node[] }
  | {
      kind: 'subscribe';
      source: Root;
      input: Hole | undefined;
      key: Hole | undefined;
      events: Event[];
    }
  | { kind: 'global'; target: 'window' | 'document'; events: Event[] }
  | {
      kind: 'child';
      component: Root;
      props: { name: string; value: Hole }[];
      messages: Event[];
      slot: Slot;
    };

export interface StateField {
  name: string;
  init: Expr;
  /** True when the `let` is assigned in some handler. */
  assigned: boolean;
}

export interface Derived {
  name: string;
  expr: Expr;
}

export type FreeKind = 'state' | 'derived' | 'props' | 'handler' | 'import' | 'module' | 'global';

/** A part of a handler between two `await`s. The first segment is the message itself. */
export interface HandlerPart {
  tag: string;
  /** Locals that live across the `await` that starts this segment, so they ride in its payload. */
  carried: string[];
  /** The awaited call, for segments after the first. */
  awaits: Root | undefined;
}

export interface Handler {
  name: string;
  params: string[];
  async: boolean;
  /** For `props`, `paths` lists the props paths read: they become payload fields computed at render. */
  free: { name: string; kind: FreeKind; paths: Path[] }[];
  writes: string[];
  segments: HandlerPart[];
  span: Span;
}

export type Severity = 'error' | 'warning';

export interface Diagnostic {
  rule: string;
  severity: Severity;
  message: string;
  span: Span;
}

export interface Component {
  name: string;
  exported: boolean;
  /** `stateful` components get a model slot. `stateless` ones are inlined at each use. */
  mode: 'stateful' | 'stateless';
  props:
    | { kind: 'param'; name: string }
    | { kind: 'pattern'; fields: { key: string; local: string }[] }
    | { kind: 'none' };
  state: StateField[];
  derived: Derived[];
  handlers: Handler[];
  view: Node[];
  /** True when the view is a document: `<html>` with one `<head>` and one `<body>`. */
  document?: true;
  /** True when `<html>` or `<body>` has a bound attribute: the loader roots the page at `<html>`. */
  documentRoot?: true;
  holes: Hole[];
}

export interface ModuleIR {
  file: string;
  components: Component[];
  diagnostics: Diagnostic[];
}
