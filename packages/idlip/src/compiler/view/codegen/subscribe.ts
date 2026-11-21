// Emits what a `<Subscribe>` needs on the client: the source chunk and the key binding.
import type { Module } from '../../../core/format.ts';
import type { Root } from '../analyze/index.ts';
import type { ChunkContext, Emitted } from './chunks.ts';
import type { Emitter } from './expr.ts';
import type { Binding, SubscribeNode } from './plan.ts';

/**
 * Emits `source=<name>`: the source function with the imports and module-level code it needs,
 * exported as `source`. An imported source such as `timer` is imported again in the chunk.
 */
export function emitSourceChunk(name: string, root: Root, context: ChunkContext): Module {
  const imports = new Set<string>();
  const modules = new Set<string>();
  if (root.kind === 'import') {
    imports.add(name);
  } else {
    modules.add(name);
  }
  const collected = context.source.collect(modules, imports);
  const blocks = [...collected.imports, ...collected.code, `export { ${name} as source };`];
  return { chunk: `source=${name}`, code: `${blocks.join('\n\n')}\n` };
}

/**
 * Emits the binding of a `<Subscribe>` whose `key` reads state. It hands the new `input` and
 * `key`, as JSON, to the loader, which restarts the run when the key differs.
 */
export function emitSubscribeBinding(
  binding: Binding,
  node: SubscribeNode,
  emitter: Emitter,
): Emitted {
  const { usage } = emitter;
  usage.loader.add('restartSub');
  const args: string[] = [];
  for (const hole of [node.input, node.key]) {
    if (hole === undefined) {
      args.push('undefined');
    } else {
      emitter.at = hole.span;
      args.push(`JSON.stringify(${emitter.expr(hole.expr, 0)})`);
    }
  }
  const names: string[] = [];
  for (const name of ['model', 'props', 'rows'] as const) {
    if (usage.scope.has(name)) {
      names.push(name);
    }
  }
  const params = names.length === 0 ? 'el' : `el, { ${names.join(', ')} }`;
  const body = `restartSub(el, ${args.join(', ')});`;
  return { code: `export function ${binding.name}(${params}) {\n${body}\n}`, usage };
}
