// oxlint-disable import/prefer-default-export
/**
 * Compares the DOM a patch left with a fresh server render and names the first node that
 * differs.
 */

interface Snapshot {
  /** An element's tag, `#text` or `#comment`. */
  readonly name: string;
  /** Text and comment data. */
  readonly data: string;
  readonly attributes: ReadonlyMap<string, string>;
  readonly children: readonly Snapshot[];
}

// A patch sets these as properties, so the attribute of the live node is stale by design.
const LIVE_PROPERTIES = new Set(['value', 'checked', 'selected']);

function readLiveProperties(element: Element, attributes: Map<string, string>): void {
  for (const name of LIVE_PROPERTIES) {
    attributes.delete(name);
  }
  // A head block that a patch adds takes a number after every block on the page.
  attributes.delete('i-head');
  if (element instanceof HTMLInputElement) {
    // A browser strips line breaks from an input's value, on a set and on a parsed attribute.
    // happy-dom does it on a set only, so both sides are sanitized here.
    attributes.set('value', element.value.replaceAll(/[\r\n]/g, ''));
    attributes.set('checked', String(element.checked));
  } else if (element instanceof HTMLTextAreaElement) {
    attributes.set('value', element.value);
  } else if (element instanceof HTMLOptionElement) {
    attributes.set('selected', String(element.selected));
  }
}

function takeSnapshots(parent: Node, skip: (node: Node) => boolean): Snapshot[] {
  const list: Snapshot[] = [];
  let text = '';
  function flushText(): void {
    // Adjacent text nodes read as one, and an empty one reads as none.
    if (text !== '') {
      list.push({ name: '#text', data: text, attributes: new Map(), children: [] });
    }
    text = '';
  }
  for (const node of parent.childNodes) {
    if (skip(node)) {
      continue;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.nodeValue ?? '';
      continue;
    }
    flushText();
    if (node.nodeType === Node.COMMENT_NODE) {
      list.push({
        name: '#comment',
        data: node.nodeValue ?? '',
        attributes: new Map(),
        children: [],
      });
    } else if (node instanceof Element) {
      const attributes = new Map<string, string>();
      for (const attribute of node.attributes) {
        attributes.set(attribute.name, attribute.value);
      }
      readLiveProperties(node, attributes);
      list.push({
        name: node.localName,
        data: '',
        attributes,
        // A textarea's text is its default value, and `value` already compares.
        children: node instanceof HTMLTextAreaElement ? [] : takeSnapshots(node, skip),
      });
    }
  }
  flushText();
  return list;
}

function describeNode(node: Snapshot): string {
  if (node.name === '#text') {
    return `text ${JSON.stringify(node.data)}`;
  }
  if (node.name === '#comment') {
    return `comment <!--${node.data}-->`;
  }
  return `<${node.name}>`;
}

function findDifference(live: Snapshot, fresh: Snapshot, path: string): string | undefined {
  if (live.name !== fresh.name || live.data !== fresh.data) {
    return `${path}: the server render has ${describeNode(fresh)}, the page has ${describeNode(live)}`;
  }
  const names = new Set([...live.attributes.keys(), ...fresh.attributes.keys()]);
  for (const name of names) {
    const expected = fresh.attributes.get(name);
    const actual = live.attributes.get(name);
    if (expected !== actual) {
      return `${path}: attribute ${name} is ${JSON.stringify(actual)} in the page and ${JSON.stringify(expected)} in the server render`;
    }
  }
  const count = Math.max(live.children.length, fresh.children.length);
  for (let index = 0; index < count; index++) {
    const liveChild = live.children.at(index);
    const freshChild = fresh.children.at(index);
    if (liveChild === undefined && freshChild !== undefined) {
      return `${path}: the page is missing child ${index}, ${describeNode(freshChild)}`;
    }
    if (liveChild !== undefined && freshChild === undefined) {
      return `${path}: the page has an extra child ${index}, ${describeNode(liveChild)}`;
    }
    if (liveChild !== undefined && freshChild !== undefined) {
      const found = findDifference(
        liveChild,
        freshChild,
        `${path} > ${describeNode(freshChild)}[${index}]`,
      );
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
}

/**
 * Returns a description of the first node where `live` and `fresh` differ, or undefined when
 * the two trees match. `skip` drops nodes of the live tree, such as the state script.
 */
export function compareTrees(
  live: Node,
  fresh: Node,
  skip: (node: Node) => boolean,
): string | undefined {
  const root: Snapshot = { name: 'root', data: '', attributes: new Map(), children: [] };
  return findDifference(
    { ...root, children: takeSnapshots(live, skip) },
    { ...root, children: takeSnapshots(fresh, () => false) },
    'root',
  );
}
