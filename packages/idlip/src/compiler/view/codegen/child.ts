// Codegen for stateful child components (`contracts/compiled-format-nesting.change-request.md`):
// the server call of a child and the client call that adds one. `chunks.ts` emits the props
// bindings of a parent and the `view` chunk of a module that a parent renders.
import { getMessage } from './events.ts';
import type { Emitter } from './expr.ts';
import type { Built, HtmlBuilder } from './html.ts';
import type { ChildNode, Plan } from './plan.ts';
import { getAccessor, getKey } from './text.ts';

/**
 * Returns the code of the model path of a child, for `path` as the code of the component's own
 * path: the site, then the key of each enclosing `<For>` and the explicit `key`.
 */
export function printSlot(emitter: Emitter, plan: Plan, node: ChildNode, path: string): string {
  const info = plan.children.get(node);
  const args = [path, String(info?.site ?? 0)];
  for (const loop of info?.loops ?? []) {
    args.push(
      loop.key.kind === 'field'
        ? `${emitter.printLoop(loop.item, false)}${getAccessor(loop.key.field, false)}`
        : emitter.expr(loop.key.expr, 1),
    );
  }
  if (node.slot.kind === 'key') {
    emitter.at = node.slot.hole.span;
    args.push(emitter.expr(node.slot.hole.expr, 1));
  }
  emitter.usage.helpers.add('slot');
  return `slot$(${args.join(', ')})`;
}

/** Prints the props of a child: the values, then the message props with their owner. */
export function printProps(
  builder: Pick<HtmlBuilder, 'component' | 'emitter'>,
  node: ChildNode,
  path: string,
): string {
  const { component, emitter } = builder;
  const entries: string[] = [];
  for (const prop of node.props) {
    emitter.at = prop.value.span;
    entries.push(`${getKey(prop.name)}: ${emitter.expr(prop.value.expr, 1)}`);
  }
  for (const event of node.messages) {
    entries.push(`${getKey(event.name)}: ${getMessage(component, event, emitter, path).code}`);
  }
  return entries.length === 0 ? '{}' : `{ ${entries.join(', ')} }`;
}

/**
 * Writes the markup of a child node: the server calls the child's module between its boundary
 * comments. A client template calls `addChild` (`template.ts`).
 */
export function addChildNode(builder: HtmlBuilder, node: ChildNode, built: Built): void {
  const { emitter, plan } = builder;
  const root = node.component;
  const info = plan.children.get(node);
  const used = plan.uses.find(
    (item) => (root.kind === 'import' || root.kind === 'module') && item.name === root.name,
  );
  if (info === undefined || used === undefined) {
    // `plan` reports a child that is neither an import nor a component of this file.
    return;
  }
  const local = `child$${info.site}`;
  built.pre.push(`const ${local} = ${printSlot(emitter, plan, node, 'path')};`);
  const props = printProps(builder, node, 'path');
  built.parts.push(
    { kind: 'text', value: '<!--n:' },
    { kind: 'code', value: local },
    { kind: 'text', value: '-->' },
    {
      kind: 'code',
      value: `${used.ref}.default(${props}, context, context.slots?.[${local}]?.model, ${local})`,
    },
    { kind: 'text', value: '<!--/n-->' },
  );
}
