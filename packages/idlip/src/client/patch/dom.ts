import { isRecord } from './guards.ts';

export type Namespace = 'svg' | 'mathml';

interface Policy {
  createHTML(html: string): string;
}

interface PolicyFactory {
  createPolicy(name: string, rules: Policy): Policy;
}

// A local view of `globalThis`, since the DOM lib has no Trusted Types.
function isPolicyFactory(value: unknown): value is PolicyFactory {
  return isRecord(value) && typeof value.createPolicy === 'function';
}

function getTrustedTypes(): PolicyFactory | undefined {
  const types: unknown = Reflect.get(globalThis, 'trustedTypes');
  return isPolicyFactory(types) ? types : undefined;
}

const rules: Policy = { createHTML: (html) => html };
let policy: Policy | undefined;

/**
 * Parses HTML into nodes through the Trusted Types policy `idlip`. `ns` parses the markup
 * inside an `<svg>` or `<math>` wrapper so it keeps its namespace.
 */
export function parseHtml(doc: Document, html: string, ns?: Namespace): Node[] {
  const template = doc.createElement('template');
  let wrapper = '';
  if (ns === 'svg') {
    wrapper = 'svg';
  } else if (ns === 'mathml') {
    wrapper = 'math';
  }
  const source = wrapper === '' ? html : `<${wrapper}>${html}</${wrapper}>`;
  policy ??= getTrustedTypes()?.createPolicy('idlip', rules) ?? rules;
  template.innerHTML = policy.createHTML(source);
  const parent = wrapper === '' ? template.content : template.content.firstChild;
  return [...(parent?.childNodes ?? [])];
}
