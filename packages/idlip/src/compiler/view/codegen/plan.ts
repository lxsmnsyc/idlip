// Plans the bindings of a component: which holes and events patch, their ids, groups and lists.
import type { Component, Event, Expr, Hole, Node, Path, Root, Span } from '../analyze/index.ts';
import type { Frame, Report } from './expr.ts';

type ForNode = Extract<Node, { kind: 'for' }>;
export type ChildNode = Extract<Node, { kind: 'child' }>;

export type Source =
  | { kind: 'attr'; name: string; hole: Hole }
  | { kind: 'prop'; child: ChildNode; name: string; hole: Hole }
  | { kind: 'message'; child: ChildNode; event: Event }
  | { kind: 'event'; event: Event }
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
}

export interface ListInfo {
  id: number;
  node: Extract<Node, { kind: 'for' }>;
  /** The id of the enclosing list. */
  parent: number | undefined;
  /** The rows around the list block. */
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
  /** The local name of the import, such as `Counter`. */
  name: string;
  /** The specifier of the import, as the source writes it. */
  source: string;
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
  eventIds: Map<Event, number>;
  /** Element and global nodes to the binding ids on them. */
  anchors: Map<Node, number[]>;
  lists: ListInfo[];
  /** Event types the view listens to, sorted. */
  events: string[];
  /** The place of every child node. */
  children: Map<Node, ChildInfo>;
  /** The child components the view renders, once each, in source order. */
  uses: Used[];
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

interface WalkContext {
  frames: Frame[];
  list: number | undefined;
  loops: ForNode[];
}

class Planner {
  bindings = new Map<number, Binding>();
  bound = new Set<number>();
  eventIds = new Map<Event, number>();
  anchors = new Map<Node, number[]>();
  lists: ListInfo[] = [];
  events = new Set<string>();
  children = new Map<Node, ChildInfo>();
  uses: Used[] = [];
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
    const paths = getStatePaths(hole.paths, this.report, hole.span, this.child);
    if (paths.length === 0) {
      return undefined;
    }
    this.bound.add(hole.id);
    this.addBinding(kind, hole.id, paths, context, source);
    return hole.id;
  }

  /** The model paths an event reads at render: its arguments, and the prop it forwards. */
  getEventPaths(event: Event): string[] {
    const paths = getStatePaths(event.paths, this.report, event.span, this.child);
    // A message prop is read from the props. It changes only when the parent passes a new one.
    if (event.target.kind === 'prop' && this.child) {
      paths.push(`props.${event.target.name}`);
      paths.sort();
    }
    return paths;
  }

  /** Assigns ids to the events that read state at render. Returns the ids. */
  bindEvents(events: Event[], context: WalkContext): number[] {
    const ids: number[] = [];
    for (const event of events) {
      if (event.target.kind !== 'handler' && event.target.kind !== 'prop') {
        this.report(
          'codegen-unsupported',
          `An event that targets a ${event.target.kind} is not generated yet`,
          event.span,
        );
        continue;
      }
      this.events.add(event.name);
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

  /** Plans a stateful child: its site, the bindings of its props and its message props. */
  planChild(node: ChildNode, context: WalkContext): void {
    this.children.set(node, { site: this.children.size, loops: context.loops });
    const root: Root = node.component;
    if (root.kind !== 'import' || root.name.includes('.')) {
      this.report(
        'codegen-unsupported',
        'A stateful child must be a component imported by its default name',
        { start: 0, end: 0 },
      );
    } else if (!this.uses.some((used) => used.name === root.name)) {
      this.uses.push({ name: root.name, source: root.source, module: '', view: '' });
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
      if (event.target.kind !== 'handler' && event.target.kind !== 'prop') {
        this.report(
          'codegen-unsupported',
          `A message prop that targets a ${event.target.kind} is not generated yet`,
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
              });
              if (id !== undefined) {
                ids.push(id);
              }
            }
          }
          ids.push(...this.bindEvents(node.events, context));
          if (node.html !== undefined) {
            this.report('codegen-unsupported', 'html is not generated yet', node.span);
          }
          if (ids.length > 0) {
            this.anchors.set(node, ids);
          }
          this.walk(node.children, context);
          break;
        }
        case 'for': {
          const id = node.each.id;
          this.bindHole(node.each, 'l', context, { kind: 'list', node });
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
          });
          break;
        }
        case 'condition':
          this.bindHole(node.test, 'c', context, { kind: 'condition', node });
          this.walk(node.then, context);
          this.walk(node.else, context);
          break;
        case 'child':
          this.planChild(node, context);
          break;
        case 'global': {
          const ids = this.bindEvents(node.events, context);
          if (ids.length > 0) {
            this.anchors.set(node, ids);
          }
          break;
        }
        default:
          this.report('codegen-unsupported', `A ${node.kind} block is not generated yet`, {
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
  planner.walk(component.view, { frames: [], list: undefined, loops: [] });
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
    eventIds: planner.eventIds,
    anchors: planner.anchors,
    lists: planner.lists,
    events: [...planner.events].sort(),
    children: planner.children,
    uses: planner.uses,
  };
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
