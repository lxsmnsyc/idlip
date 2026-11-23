// Plans the bindings of a component: which holes and events patch, their ids, groups and lists.
import type { Component, Event, Expr, Hole, Node, Path, Root, Span } from '../analyze/index.ts';
import type { UrlKind } from '../../../core/url.ts';
import type { Frame, Report } from './expr.ts';
import { listSendTags } from './events.ts';

type ForNode = Extract<Node, { kind: 'for' }>;
export type ChildNode = Extract<Node, { kind: 'child' }>;
export type SubscribeNode = Extract<Node, { kind: 'subscribe' }>;
export type TryNode = Extract<Node, { kind: 'try' }>;
export type HeadNode = Extract<Node, { kind: 'head' }>;
type ElementNode = Extract<Node, { kind: 'element' }>;

export type Source =
  | { kind: 'attr'; name: string; hole: Hole; url?: UrlKind }
  | { kind: 'html'; node: Extract<Node, { kind: 'element' }>; hole: Hole }
  | { kind: 'prop'; child: ChildNode; name: string; hole: Hole }
  | { kind: 'message'; child: ChildNode; event: Event }
  | { kind: 'event'; event: Event }
  | { kind: 'subscribe'; node: SubscribeNode }
  | { kind: 'head-attr'; index: number; name: string; hole: Hole }
  | { kind: 'head-title'; index: number; children: Node[] }
  | { kind: 'text'; hole: Hole }
  | { kind: 'condition'; node: Extract<Node, { kind: 'condition' }> }
  | { kind: 'list'; node: Extract<Node, { kind: 'for' }> };

export interface Binding {
  id: number;
  /** `a` for an element, `t` for text, `c` for a condition, `l` for a list, `p` for a prop. */
  kind: 'a' | 't' | 'c' | 'l' | 'p';
  /** The export name, such as `a4`. */
  name: string;
  /** The state paths the binding reads, sorted. Never empty. */
  paths: string[];
  /** The rows around the binding, outermost first. */
  frames: Frame[];
  /** The id of the list whose rows hold the binding. */
  list: number | undefined;
  source: Source;
  /** A dynamic hole: its paths are not known at build time, so `paths` is empty. */
  dynamic?: true;
}

/** The function of an event arrow, in the handler chunk of the first handler it calls. */
export interface Site {
  /** The attribute value and the export name, such as `$e3`. */
  name: string;
  event: Event;
  /** The rows around the element, outermost first. */
  frames: Frame[];
  /** The `<For>` blocks around the element, outermost first. */
  loops: ForNode[];
  /** The handlers the arrow may send, in source order. The first one holds the function. */
  tags: string[];
}

export interface ListInfo {
  id: number;
  node: Extract<Node, { kind: 'for' }>;
  /** The id of the enclosing list. */
  parent: number | undefined;
  /** The rows around the list block. */
  frames: Frame[];
}

/** A `<Try>` region. Its id is the number of the region marker `<!--e<id>:<state>-->`. */
export interface TryInfo {
  id: number;
  node: TryNode;
  /** The rows around the region, outermost first. */
  frames: Frame[];
}

/** Where a child component sits in its parent. */
export interface ChildInfo {
  /** The index of the child among all child nodes of the view, in source order. */
  site: number;
  /** The `<For>` blocks around the child, outermost first. */
  loops: ForNode[];
}

/** A stateful component that the view renders. */
export interface Used {
  /** The local name of the import or of the component in this file, such as `Counter`. */
  name: string;
  /** The specifier of the import, as the source writes it. `''` for a component of this file. */
  source: string;
  /**
   * The name the server module reads the child's module record from: the import's local name,
   * or `$<Name>` for a component of this file. `generate` sets it.
   */
  ref: string;
  /** The id of the child's module, which `generate` resolves from the specifier. */
  module: string;
  /** The id of the child's `view` chunk. */
  view: string;
}

export interface Group {
  key: string;
  paths: string[];
  /** Own bindings, by id. */
  bindings: Binding[];
  /** Keys of the groups this one covers. */
  covers: string[];
}

export interface Plan {
  /** Bindings by id, ascending. */
  bindings: Binding[];
  /** Hole ids that have a binding. */
  bound: Set<number>;
  /**
   * Bound text holes that are the only child of their element. The element's `i-a` holds the
   * id, the binding is `a<id>` and sets the element's text, and the hole writes no
   * `<!--t<id>-->` markers.
   */
  filled: Set<number>;
  /** Hole ids of the dynamic holes. */
  dynamic: Set<number>;
  eventIds: Map<Event, number>;
  /** The event functions, in source order. */
  sites: Site[];
  /** The site of each event whose body is steps. */
  siteOf: Map<Event, Site>;
  /** Element and global nodes to the binding ids on them. */
  anchors: Map<Node, number[]>;
  lists: ListInfo[];
  /** Event types the view listens to, sorted. */
  events: string[];
  /** Event type to the names of the handlers that elements of the view dispatch on it. */
  listens: Map<string, string[]>;
  /** The place of every child node. */
  children: Map<Node, ChildInfo>;
  /** The child components the view renders, once each, in source order. */
  uses: Used[];
  /** The id of the marker block of each `<Subscribe>`. */
  subs: Map<Node, number>;
  /** The sources the view subscribes to, by name, in source order. */
  sources: Map<string, Root>;
  /** The `<Try>` regions of the view, in view order. */
  tries: TryInfo[];
  /** The region id of each `<Try>` node. */
  tryIds: Map<Node, number>;
  /** The id of the marker block of each `<Head>`. */
  heads: Map<Node, number>;
}

/**
 * Elements whose text cannot hold the hole alone: the parser reads the text of the first four
 * as text, and drops a newline that starts the text of the last two.
 */
// Raw-text and template contents are not plain children, and `pre` drops a leading newline.
const UNFILLED_TAGS = new Set([
  'script',
  'style',
  'textarea',
  'title',
  'pre',
  'listing',
  'template',
  'xmp',
  'iframe',
  'noembed',
  'noframes',
  'noscript',
]);

/** Returns the text hole that is the only child of an element, if the element can hold it alone. */
export function getFilledHole(node: ElementNode): Hole | undefined {
  const [only] = node.children;
  if (node.children.length !== 1 || only.kind !== 'text-hole' || UNFILLED_TAGS.has(node.tag)) {
    return undefined;
  }
  return only.hole;
}

/** Prints the source of a keyed segment: the model path of its value. */
function printPathSource(expr: Expr): string {
  const parts: string[] = [];
  if (expr.kind === 'path' && expr.root.kind === 'state') {
    parts.push(expr.root.name);
    for (const segment of expr.segments) {
      if (typeof segment === 'string') {
        parts.push(segment);
      }
    }
  }
  return parts.join('.');
}

/** Prints a path as the manifest writes it: `todos.*.done`. */
export function printPathKey(path: Path, report: Report, span: Span): string {
  const parts: string[] = [];
  for (const segment of path.segments) {
    if (typeof segment === 'string') {
      parts.push(segment);
    } else if (segment.kind === 'item') {
      parts.push('*');
    } else if (segment.kind === 'keyed') {
      // The analysis keeps a keyed segment only when its value is a state path.
      const last = parts.length - 1;
      parts[last] = `${parts[last]}[${segment.field}=${printPathSource(segment.value)}]`;
    } else {
      report('codegen-unsupported', `A ${segment.kind} path segment is not generated yet`, span);
    }
  }
  return [...(path.root === 'props' ? ['props'] : []), ...parts].join('.');
}

/** Returns the sorted state paths of a hole or event, or an empty list when nothing patches. */
export function getStatePaths(
  paths: Path[] | 'dynamic',
  report: Report,
  span: Span,
  child = false,
): string[] {
  if (paths === 'dynamic') {
    report('hole-dynamic', 'A dynamic path set cannot be generated', span);
    return [];
  }
  const keys = new Set<string>();
  for (const path of paths) {
    // Root props never change, so only state paths patch. A child's props change with the parent.
    if (path.root === 'state' || child) {
      keys.add(printPathKey(path, report, span));
    }
  }
  return [...keys].sort();
}

/** The path of `each` when it is a plain path that reads one state path. */
export function getListPath(info: ListInfo, child: boolean): string | undefined {
  const each = info.node.each;
  if (each.expr.kind === 'path' && each.paths !== 'dynamic') {
    const paths = getStatePaths(each.paths, () => {}, each.span, child);
    if (paths.length === 1) {
      return paths[0];
    }
  }
  return undefined;
}

interface WalkContext {
  frames: Frame[];
  list: number | undefined;
  loops: ForNode[];
  /** The condition and `<Try>` blocks around the node. */
  blocks: number;
}

class Planner {
  bindings = new Map<number, Binding>();
  bound = new Set<number>();
  filled = new Set<number>();
  dynamic = new Set<number>();
  eventIds = new Map<Event, number>();
  sites: Site[] = [];
  siteOf = new Map<Event, Site>();
  anchors = new Map<Node, number[]>();
  lists: ListInfo[] = [];
  events = new Set<string>();
  listens = new Map<string, Set<string>>();
  children = new Map<Node, ChildInfo>();
  uses: Used[] = [];
  subs = new Map<Node, number>();
  sources = new Map<string, Root>();
  tries: TryInfo[] = [];
  tryIds = new Map<Node, number>();
  heads = new Map<Node, number>();
  nextEvent: number;

  constructor(
    component: Component,
    readonly report: Report,
    readonly child: boolean,
  ) {
    let max = -1;
    for (const hole of component.holes) {
      max = Math.max(max, hole.id);
    }
    this.nextEvent = max + 1;
  }

  addBinding(
    kind: Binding['kind'],
    id: number,
    paths: string[],
    context: WalkContext,
    source: Source,
  ): void {
    this.bindings.set(id, {
      id,
      kind,
      name: `${kind}${id}`,
      paths,
      frames: context.frames,
      list: context.list,
      source,
    });
  }

  /** Binds a hole when it reads state. Returns its binding id, or `undefined`. */
  bindHole(
    hole: Hole,
    kind: Binding['kind'],
    context: WalkContext,
    source: Source,
  ): number | undefined {
    const tracked =
      hole.paths === 'dynamic' &&
      context.frames.length === 0 &&
      context.blocks === 0 &&
      !this.child;
    if (tracked) {
      return this.bindDynamic(hole, kind, context, source);
    }
    // Rows, blocks and children render from templates that record no reads, so a dynamic hole
    // there keeps the static paths of the analysis.
    const paths = getStatePaths(
      hole.paths === 'dynamic' ? (hole.fallback ?? []) : hole.paths,
      this.report,
      hole.span,
      this.child,
    );
    if (paths.length === 0) {
      return undefined;
    }
    this.bound.add(hole.id);
    this.addBinding(kind, hole.id, paths, context, source);
    return hole.id;
  }

  /** Whether a binding sits in the rows of the list, or of a list inside them. */
  hasRowBinding(list: number): boolean {
    for (const binding of this.bindings.values()) {
      if (binding.list === list) {
        return true;
      }
    }
    for (const inner of this.lists) {
      if (inner.parent === list && this.hasRowBinding(inner.id)) {
        return true;
      }
    }
    return false;
  }

  /** Binds a dynamic hole at the top level of a root component, where reads are recorded. */
  bindDynamic(
    hole: Hole,
    kind: Binding['kind'],
    context: WalkContext,
    source: Source,
  ): number | undefined {
    this.bound.add(hole.id);
    this.dynamic.add(hole.id);
    this.addBinding(kind, hole.id, [], context, source);
    const binding = this.bindings.get(hole.id);
    if (binding !== undefined) {
      binding.dynamic = true;
    }
    return hole.id;
  }

  /** The model paths an event reads at render: its arguments, and the prop it forwards. */
  getEventPaths(event: Event): string[] {
    if (event.body.kind !== 'message') {
      return [];
    }
    const { target } = event.body;
    const paths = getStatePaths(event.body.paths, this.report, event.span, this.child);
    // A message prop is read from the props. It changes only when the parent passes a new one.
    if (target.kind === 'prop' && this.child) {
      paths.push(`props.${target.name}`);
      paths.sort();
    }
    return paths;
  }

  /** Assigns ids to the events that read state at render. Returns the ids. */
  bindEvents(
    events: Event[],
    context: WalkContext,
    listen = true,
    global?: 'window' | 'document',
  ): number[] {
    const ids: number[] = [];
    for (const event of events) {
      const { body } = event;
      if (body.kind === 'message' && body.target.kind === 'reset') {
        continue;
      }
      // The loader reads `on:value` of a subscription itself, so no listener is needed.
      if (listen) {
        // A global event lists as `type:window` or `type:document`, so the early listener adds
        // its global listener only for the types a global element uses.
        this.events.add(global === undefined ? event.name : `${event.name}:${global}`);
      }
      if (body.kind === 'steps') {
        this.planSite(event, context, listen);
        continue;
      }
      const paths = this.getEventPaths(event);
      if (paths.length === 0) {
        continue;
      }
      const id = this.nextEvent++;
      this.eventIds.set(event, id);
      this.addBinding('a', id, paths, context, { kind: 'event', event });
      ids.push(id);
    }
    return ids;
  }

  /** Gives an event arrow its function. The tags it may send go in `listens`. */
  planSite(event: Event, context: WalkContext, listen = true): void {
    if (event.body.kind !== 'steps') {
      return;
    }
    const tags = listSendTags(event.body.steps);
    const site: Site = {
      name: `$e${this.sites.length}`,
      event,
      frames: context.frames,
      loops: context.loops,
      tags,
    };
    this.sites.push(site);
    this.siteOf.set(event, site);
    if (listen) {
      const names = this.listens.get(event.name) ?? new Set<string>();
      for (const tag of tags) {
        names.add(tag);
      }
      this.listens.set(event.name, names);
    }
  }

  /** Plans a stateful child: its site, the bindings of its props and its message props. */
  planChild(node: ChildNode, context: WalkContext): void {
    this.children.set(node, { site: this.children.size, loops: context.loops });
    const root: Root = node.component;
    if ((root.kind !== 'import' && root.kind !== 'module') || root.name.includes('.')) {
      this.report(
        'codegen-unsupported',
        'A stateful child must be a component of this file or one imported by name, such as `import Counter from` or `import { Counter } from`',
        { start: 0, end: 0 },
      );
    } else if (!this.uses.some((used) => used.name === root.name)) {
      const source = root.kind === 'import' ? root.source : '';
      this.uses.push({ name: root.name, source, ref: root.name, module: '', view: '' });
    }
    for (const prop of node.props) {
      this.bindHole(prop.value, 'p', context, {
        kind: 'prop',
        child: node,
        name: prop.name,
        hole: prop.value,
      });
    }
    for (const event of node.messages) {
      if (
        event.body.kind !== 'message' ||
        (event.body.target.kind !== 'handler' && event.body.target.kind !== 'prop')
      ) {
        this.report(
          'codegen-unsupported',
          'A message prop that is not a handler call is not generated yet',
          event.span,
        );
        continue;
      }
      const paths = this.getEventPaths(event);
      if (paths.length === 0) {
        continue;
      }
      const id = this.nextEvent++;
      this.eventIds.set(event, id);
      this.addBinding('p', id, paths, context, { kind: 'message', child: node, event });
    }
  }

  /**
   * Checks the catch view. It is rendered once, from the state at the time of the failure, so
   * nothing in it patches: it gets no bindings. It listens to the events it names, and it may
   * hold elements, text, holes and conditions.
   */
  scanCatch(nodes: Node[], context: WalkContext): void {
    for (const node of nodes) {
      switch (node.kind) {
        case 'text':
        case 'text-hole':
          break;
        case 'element':
          for (const event of node.events) {
            this.events.add(event.name);
            this.planSite(event, context);
          }
          this.scanCatch(node.children, context);
          break;
        case 'condition':
          this.scanCatch(node.then, context);
          this.scanCatch(node.else, context);
          break;
        default:
          this.report(
            'try-catch-node',
            `A ${node.kind} block in the catch view of <Try> is not supported`,
            { start: 0, end: 0 },
          );
      }
    }
  }

  /** Plans the bindings of one element of a `<Head>`. Returns the ids. */
  planHeadElement(element: ElementNode, index: number, context: WalkContext): number[] {
    const ids: number[] = [];
    for (const attr of element.attrs) {
      if (attr.value.kind === 'hole') {
        const id = this.bindHole(attr.value.hole, 'a', context, {
          kind: 'head-attr',
          index,
          name: attr.name,
          hole: attr.value.hole,
        });
        if (id !== undefined) {
          ids.push(id);
        }
      }
    }
    if (element.events.length > 0 || element.ref !== undefined || element.html !== undefined) {
      this.report(
        'codegen-unsupported',
        'A head element takes no events, ref or html',
        element.span,
      );
    }
    if (element.tag === 'title') {
      // The holes of a title are not patched one by one: one binding sets the whole text.
      const paths = new Set<string>();
      let first: Hole | undefined;
      for (const child of element.children) {
        if (child.kind === 'text-hole') {
          first ??= child.hole;
          for (const path of getStatePaths(
            child.hole.paths,
            this.report,
            child.hole.span,
            this.child,
          )) {
            paths.add(path);
          }
        }
      }
      if (first !== undefined && paths.size > 0) {
        this.addBinding('a', first.id, [...paths].sort(), context, {
          kind: 'head-title',
          index,
          children: element.children,
        });
        ids.push(first.id);
      }
    }
    return ids;
  }

  walk(nodes: Node[], context: WalkContext): void {
    for (const node of nodes) {
      switch (node.kind) {
        case 'text':
          break;
        case 'text-hole':
          this.bindHole(node.hole, 't', context, { kind: 'text', hole: node.hole });
          break;
        case 'element': {
          const ids: number[] = [];
          for (const attr of node.attrs) {
            if (attr.value.kind === 'hole') {
              const id = this.bindHole(attr.value.hole, 'a', context, {
                kind: 'attr',
                name: attr.name,
                hole: attr.value.hole,
                url: attr.url,
              });
              if (id !== undefined) {
                ids.push(id);
              }
            }
          }
          ids.push(...this.bindEvents(node.events, context));
          if (node.html !== undefined) {
            const id = this.bindHole(node.html, 'a', context, {
              kind: 'html',
              node,
              hole: node.html,
            });
            if (id !== undefined) {
              ids.push(id);
            }
          }
          // A bound text that is the element's only child is patched through the element.
          const only = getFilledHole(node);
          const filled =
            only === undefined
              ? undefined
              : this.bindHole(only, 'a', context, { kind: 'text', hole: only });
          if (filled === undefined) {
            this.walk(node.children, context);
          } else {
            ids.push(filled);
            this.filled.add(filled);
          }
          if (ids.length > 0) {
            this.anchors.set(node, ids);
          }
          break;
        }
        case 'for': {
          const id = node.each.id;
          const listed = this.bindHole(node.each, 'l', context, { kind: 'list', node });
          const frame: Frame = {
            item: node.item,
            index: node.index,
            row: context.frames.length,
          };
          this.lists.push({ id, node, parent: context.list, frames: context.frames });
          this.walk(node.body, {
            frames: [...context.frames, frame],
            list: id,
            loops: [...context.loops, node],
            blocks: context.blocks,
          });
          // A list read from props has no state path, but its row bindings still need its `l`
          // binding to reach the rows. It joins no group (no paths) and rides in their chunks.
          if (listed === undefined && this.hasRowBinding(id)) {
            this.bound.add(id);
            this.addBinding('l', id, [], context, { kind: 'list', node });
          }
          break;
        }
        case 'condition':
          this.bindHole(node.test, 'c', context, { kind: 'condition', node });
          this.walk(node.then, { ...context, blocks: context.blocks + 1 });
          this.walk(node.else, { ...context, blocks: context.blocks + 1 });
          break;
        case 'child':
          this.planChild(node, context);
          break;
        case 'subscribe': {
          this.subs.set(node, this.nextEvent++);
          if (node.source.kind === 'import' || node.source.kind === 'module') {
            this.sources.set(node.source.name, node.source);
          }
          // The key binding restarts the run. Without a state path in the key nothing patches.
          const ids: number[] = [];
          if (node.key !== undefined) {
            const id = this.bindHole(node.key, 'a', context, { kind: 'subscribe', node });
            if (id !== undefined) {
              ids.push(id);
            }
          }
          ids.push(...this.bindEvents(node.events, context, false));
          if (ids.length > 0) {
            this.anchors.set(node, ids);
          }
          break;
        }
        case 'try': {
          // Regions count on their own, so a `<Try>` never renames the ids that follow it.
          const id = this.tries.length;
          this.tryIds.set(node, id);
          this.tries.push({ id, node, frames: context.frames });
          this.walk(node.body, { ...context, blocks: context.blocks + 1 });
          this.scanCatch(node.catch, context);
          break;
        }
        case 'head': {
          this.heads.set(node, this.nextEvent++);
          const ids: number[] = [];
          let index = 0;
          let titles = 0;
          for (const child of node.children) {
            if (child.kind !== 'element') {
              this.report('codegen-unsupported', 'A <Head> holds elements only', {
                start: 0,
                end: 0,
              });
              continue;
            }
            titles += child.tag === 'title' ? 1 : 0;
            if (titles > 1) {
              this.report('head-title-twice', 'A <Head> holds one <title>', child.span);
              continue;
            }
            ids.push(...this.planHeadElement(child, index, context));
            index++;
          }
          if (ids.length > 0) {
            this.anchors.set(node, ids);
          }
          break;
        }
        case 'global': {
          const ids = this.bindEvents(node.events, context, true, node.target);
          if (ids.length > 0) {
            this.anchors.set(node, ids);
          }
          break;
        }
        default:
          this.report('codegen-unsupported', 'A block is not generated yet', {
            start: 0,
            end: 0,
          });
      }
    }
  }
}

/** Plans the bindings of a component's view. */
export function planBindings(component: Component, report: Report, child = false): Plan {
  const planner = new Planner(component, report, child);
  planner.walk(component.view, { frames: [], list: undefined, loops: [], blocks: 0 });
  // Order by id: holes in view order, then events.
  const ids = [...planner.bindings.keys()].sort((a, b) => a - b);
  const bindings: Binding[] = [];
  for (const id of ids) {
    const binding = planner.bindings.get(id);
    if (binding !== undefined) {
      bindings.push(binding);
    }
  }
  return {
    bindings,
    bound: planner.bound,
    filled: planner.filled,
    dynamic: planner.dynamic,
    eventIds: planner.eventIds,
    sites: planner.sites,
    siteOf: planner.siteOf,
    anchors: planner.anchors,
    lists: planner.lists,
    events: [...planner.events].sort(),
    listens: sortListens(planner.listens),
    children: planner.children,
    uses: planner.uses,
    subs: planner.subs,
    sources: planner.sources,
    tries: planner.tries,
    tryIds: planner.tryIds,
    heads: planner.heads,
  };
}

/** Sorts the event types and the handler names of each. */
function sortListens(listens: ReadonlyMap<string, ReadonlySet<string>>): Map<string, string[]> {
  const sorted = new Map<string, string[]>();
  for (const type of [...listens.keys()].sort()) {
    sorted.set(type, [...(listens.get(type) ?? [])].sort());
  }
  return sorted;
}

function countSegments(key: string): number {
  return key.split('.').length;
}

function hasPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}.`);
}

/**
 * Groups bindings by path set, and sorts the groups by their longest path (most segments
 * first), then by key. A group covers another when every path of it has a prefix in the other.
 */
export function planGroups(bindings: Binding[]): Group[] {
  const byKey = new Map<string, Group>();
  for (const binding of bindings) {
    // A list of props has no path, and rides in the chunks of its row bindings.
    if (binding.paths.length === 0 && binding.dynamic !== true) {
      continue;
    }
    const key = binding.paths.join(',');
    let group = byKey.get(key);
    if (group === undefined) {
      group = { key, paths: binding.paths, bindings: [], covers: [] };
      byKey.set(key, group);
    }
    group.bindings.push(binding);
  }
  const groups = [...byKey.values()];
  const longest = new Map<string, number>();
  for (const group of groups) {
    let max = 0;
    for (const path of group.paths) {
      max = Math.max(max, countSegments(path));
    }
    longest.set(group.key, max);
  }
  groups.sort((a, b) => {
    const difference = (longest.get(b.key) ?? 0) - (longest.get(a.key) ?? 0);
    if (difference !== 0) {
      return difference;
    }
    if (a.key === b.key) {
      return 0;
    }
    return a.key < b.key ? -1 : 1;
  });
  for (const group of groups) {
    for (const other of groups) {
      if (other === group) {
        continue;
      }
      let covers = true;
      for (const path of group.paths) {
        let found = false;
        for (const prefix of other.paths) {
          if (hasPrefix(path, prefix)) {
            found = true;
            break;
          }
        }
        if (!found) {
          covers = false;
          break;
        }
      }
      if (covers) {
        group.covers.push(other.key);
      }
    }
  }
  return orderByCovers(groups);
}

/**
 * Puts every group before the groups it covers. Among the groups that can go next, the one
 * earliest in the given order goes first, so the longest path and then the key still decide.
 */
function orderByCovers(groups: Group[]): Group[] {
  const covered = new Map<string, number>();
  for (const group of groups) {
    for (const key of group.covers) {
      covered.set(key, (covered.get(key) ?? 0) + 1);
    }
  }
  const ordered: Group[] = [];
  const remaining = [...groups];
  while (remaining.length > 0) {
    // A group is ready when no remaining group covers it.
    let at = remaining.findIndex((group) => (covered.get(group.key) ?? 0) === 0);
    if (at === -1) {
      at = 0;
    }
    const [next] = remaining.splice(at, 1);
    ordered.push(next);
    for (const key of next.covers) {
      covered.set(key, (covered.get(key) ?? 0) - 1);
    }
  }
  return ordered;
}
