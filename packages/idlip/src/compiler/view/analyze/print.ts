// Prints a ModuleIR as text. The contract tests compare this text with the recorded output.
import type { Event, Expr, ModuleIR, Node, Path, Root, Segment } from './ir.ts';

function printSegment(segment: Segment): string {
  if (typeof segment === 'string') {
    return segment;
  }
  if (segment.kind === 'item') {
    return '*';
  }
  if (segment.kind === 'index') {
    return `[${printExpr(segment.value)}]`;
  }
  return `[${segment.field}=${printExpr(segment.value)}]`;
}

export function printPath(path: Path): string {
  const parts: string[] = [];
  if (path.root === 'props') {
    parts.push('props');
  }
  let text = parts.join('.');
  for (const segment of path.segments) {
    const printed = printSegment(segment);
    text += printed.startsWith('[') ? printed : `${text === '' ? '' : '.'}${printed}`;
  }
  return text;
}

function printRoot(root: Root): string {
  switch (root.kind) {
    case 'state':
      return root.name;
    case 'props':
      return 'props';
    case 'loop':
      return root.name;
    case 'event':
      return '$event';
    case 'local':
      return root.name;
    case 'global':
      return root.name;
    case 'import':
      return root.name;
    default:
      // `module`
      return root.name;
  }
}

export function printExpr(expr: Expr): string {
  switch (expr.kind) {
    case 'literal':
      return expr.value === undefined ? 'undefined' : JSON.stringify(expr.value);
    case 'path': {
      let text = printRoot(expr.root);
      for (const segment of expr.segments) {
        const printed = printSegment(segment);
        text += printed.startsWith('[') ? printed : `.${printed}`;
      }
      return text;
    }
    case 'unary':
      return `${expr.op}${expr.op === 'typeof' ? ' ' : ''}${printExpr(expr.arg)}`;
    case 'binary':
    case 'logical':
      return `(${printExpr(expr.left)} ${expr.op} ${printExpr(expr.right)})`;
    case 'conditional':
      return `(${printExpr(expr.test)} ? ${printExpr(expr.then)} : ${printExpr(expr.else)})`;
    case 'template': {
      let text = '`';
      for (const [index, quasi] of expr.quasis.entries()) {
        text += quasi;
        if (index < expr.exprs.length) {
          text += `\${${printExpr(expr.exprs[index])}}`;
        }
      }
      return `${text}\``;
    }
    case 'object': {
      const parts: string[] = [];
      for (const entry of expr.entries) {
        parts.push(`${entry.key}: ${printExpr(entry.value)}`);
      }
      return `{ ${parts.join(', ')} }`;
    }
    case 'array': {
      const parts: string[] = [];
      for (const item of expr.items) {
        parts.push(printExpr(item));
      }
      return `[${parts.join(', ')}]`;
    }
    case 'property':
      return `${printExpr(expr.receiver)}.${expr.name}`;
    case 'method': {
      const parts: string[] = [];
      for (const item of expr.args) {
        parts.push(printExpr(item));
      }
      return `${printExpr(expr.receiver)}.${expr.name}(${parts.join(', ')})`;
    }
    default: {
      // `call`
      const parts: string[] = [];
      for (const item of expr.args) {
        parts.push(printExpr(item));
      }
      const call = `${printRoot(expr.callee)}(${parts.join(', ')})`;
      return expr.helper === 'inlined' ? `${call} => ${printExpr(expr.body)}` : call;
    }
  }
}

function printPaths(paths: Path[] | 'dynamic'): string {
  if (paths === 'dynamic') {
    return 'dynamic';
  }
  if (paths.length === 0) {
    return '(static)';
  }
  const parts: string[] = [];
  for (const path of paths) {
    parts.push(printPath(path));
  }
  return parts.join(', ');
}

function printEvent(event: Event): string {
  let target: string;
  if (event.target.kind === 'handler') {
    target = event.target.name;
  } else if (event.target.kind === 'prop') {
    target = `props.${event.target.name}`;
  } else {
    target = 'reset';
  }
  const args: string[] = [];
  for (const arg of event.args) {
    args.push(printExpr(arg));
  }
  const render = event.paths.length > 0 ? `  render reads ${printPaths(event.paths)}` : '';
  const names: string[] = [];
  for (const modifier of event.modifiers) {
    names.push(modifier.kind === 'key' ? `key:${modifier.filter}` : modifier.kind);
  }
  const modifiers = names.length > 0 ? `  modifiers ${names.join(' ')}` : '';
  return `${event.mode}:${event.name} -> ${target}(${args.join(', ')})${render}${modifiers}`;
}

function printNodes(nodes: Node[], indent: string, out: string[]): void {
  for (const node of nodes) {
    switch (node.kind) {
      case 'text':
        out.push(`${indent}"${node.value}"`);
        break;
      case 'text-hole':
        out.push(`${indent}{#${node.hole.id}}`);
        break;
      case 'element': {
        const parts: string[] = [node.tag];
        if (node.namespace !== 'html') {
          parts.push(`ns=${node.namespace}`);
        }
        for (const attr of node.attrs) {
          parts.push(
            attr.value.kind === 'static'
              ? `${attr.name}=${JSON.stringify(attr.value.value)}`
              : `${attr.name}={#${attr.value.hole.id}}`,
          );
        }
        if (node.ref !== undefined) {
          parts.push(
            node.ref.kind === 'name'
              ? `ref=${node.ref.name}`
              : `ref=[${node.ref.name}, ${printExpr(node.ref.key)}]`,
          );
        }
        if (node.html !== undefined) {
          parts.push(`html={#${node.html.id}}`);
        }
        for (const event of node.events) {
          parts.push(`[${printEvent(event)}]`);
        }
        out.push(`${indent}<${parts.join(' ')}>`);
        printNodes(node.children, `${indent}  `, out);
        break;
      }
      case 'for':
        out.push(
          `${indent}for #${node.each.id} key=${node.key} item=${node.item}${node.index ? ` index=${node.index}` : ''}`,
        );
        printNodes(node.body, `${indent}  `, out);
        break;
      case 'condition':
        out.push(`${indent}if #${node.test.id}`);
        printNodes(node.then, `${indent}  `, out);
        if (node.else.length > 0) {
          out.push(`${indent}else`);
          printNodes(node.else, `${indent}  `, out);
        }
        break;
      case 'try':
        out.push(`${indent}try`);
        printNodes(node.body, `${indent}  `, out);
        out.push(`${indent}catch (${node.error}${node.reset ? `, ${node.reset}` : ''})`);
        printNodes(node.catch, `${indent}  `, out);
        break;
      case 'head':
        out.push(`${indent}head`);
        printNodes(node.children, `${indent}  `, out);
        break;
      case 'subscribe': {
        const events: string[] = [];
        for (const event of node.events) {
          events.push(`[${printEvent(event)}]`);
        }
        out.push(
          `${indent}subscribe ${printRoot(node.source)}${node.input ? ` input=#${node.input.id}` : ''}${node.key ? ` key=#${node.key.id}` : ''} ${events.join(' ')}`,
        );
        break;
      }
      case 'global': {
        const events: string[] = [];
        for (const event of node.events) {
          events.push(`[${printEvent(event)}]`);
        }
        out.push(`${indent}${node.target} ${events.join(' ')}`);
        break;
      }
      case 'child': {
        const parts: string[] = [];
        for (const prop of node.props) {
          parts.push(`${prop.name}={#${prop.value.id}}`);
        }
        for (const event of node.messages) {
          parts.push(`[${printEvent(event)}]`);
        }
        let slot: string;
        if (node.slot.kind === 'key') {
          slot = `key #${node.slot.hole.id}`;
        } else if (node.slot.kind === 'for-key') {
          slot = 'for-key';
        } else {
          slot = `position ${node.slot.index}`;
        }
        out.push(`${indent}child ${printRoot(node.component)} slot=${slot} ${parts.join(' ')}`);
        break;
      }
    }
  }
}

/** The 1-based `line:column` of an offset. */
export function locate(source: string, offset: number): string {
  let line = 1;
  let column = 1;
  for (let index = 0; index < offset; index++) {
    if (source[index] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return `${line}:${column}`;
}

export function printModule(ir: ModuleIR, source: string): string {
  const out: string[] = [`file ${ir.file}`];
  for (const component of ir.components) {
    out.push(
      '',
      `component ${component.name} (${component.mode}${component.exported ? ', exported' : ''})`,
    );
    if (component.props.kind === 'param') {
      out.push(`  props: ${component.props.name}`);
    } else if (component.props.kind === 'pattern') {
      const fields: string[] = [];
      for (const field of component.props.fields) {
        fields.push(field.key === field.local ? field.key : `${field.key}: ${field.local}`);
      }
      out.push(`  props: { ${fields.join(', ')} }`);
    }
    if (component.state.length > 0) {
      out.push('  state:');
    }
    for (const field of component.state) {
      out.push(`    ${field.name} = ${printExpr(field.init)}`);
    }
    if (component.derived.length > 0) {
      out.push('  derived:');
    }
    for (const derived of component.derived) {
      out.push(`    ${derived.name} = ${printExpr(derived.expr)}`);
    }
    if (component.handlers.length > 0) {
      out.push('  handlers:');
    }
    for (const handler of component.handlers) {
      const free: string[] = [];
      for (const entry of handler.free) {
        free.push(
          entry.paths.length > 0
            ? `${entry.name}:${entry.kind}(${printPaths(entry.paths)})`
            : `${entry.name}:${entry.kind}`,
        );
      }
      out.push(`    ${handler.async ? 'async ' : ''}${handler.name}(${handler.params.join(', ')})`);
      out.push(`      free: ${free.join(' ') || '-'}`);
      out.push(`      writes: ${handler.writes.join(' ') || '-'}`);
      if (handler.segments.length > 1) {
        for (const segment of handler.segments.slice(1)) {
          out.push(
            `      segment ${segment.tag} after await ${segment.awaits ? printRoot(segment.awaits) : '?'}, carries: ${segment.carried.join(' ') || '-'}`,
          );
        }
      }
    }
    out.push('  view:');
    printNodes(component.view, '    ', out);
    out.push('  holes:');
    for (const hole of component.holes) {
      out.push(
        `    #${hole.id} ${source.slice(hole.span.start, hole.span.end).replaceAll(/\s+/g, ' ')}`,
      );
      out.push(`        expr  ${printExpr(hole.expr)}`);
      out.push(`        paths ${printPaths(hole.paths)}`);
    }
  }
  out.push('', `diagnostics: ${ir.diagnostics.length}`);
  for (const diagnostic of ir.diagnostics) {
    out.push(
      `  ${locate(source, diagnostic.span.start)} ${diagnostic.severity} ${diagnostic.rule}: ${diagnostic.message}`,
    );
  }
  return out.join('\n');
}
