import { test as base, expect } from '@playwright/test';
import type { Page, Request } from '@playwright/test';
import getChunkName from '../fixture/chunk.ts';

declare global {
  interface Window {
    idlipDecoded: number;
    idlipViolations: string[];
  }
}

// Counts calls of the state function without reading runtime internals: the page wraps the
// function of each record that is pushed to `self.$idlip`. The state script is lazy, so the
// count is the number of decodes.
function watchState(): void {
  const wrapped = new WeakSet<object>();
  let push: ((...records: unknown[][]) => number) | undefined;
  window.idlipDecoded = 0;
  window.idlipViolations = [];
  document.addEventListener('securitypolicyviolation', (event) => {
    window.idlipViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
  });
  function wrap(record: unknown[]): unknown[] {
    const [events, state] = record;
    if (wrapped.has(record) || typeof state !== 'function') {
      return record;
    }
    const next = [
      events,
      (): unknown => {
        window.idlipDecoded++;
        return Reflect.apply(state, undefined, []) as unknown;
      },
    ];
    wrapped.add(next);
    return next;
  }
  const store: unknown[] = [];
  function pushRecords(...records: unknown[][]): number {
    return store.push(...records.map(wrap));
  }
  const boot = new Proxy<unknown[]>(store, {
    get(target, key, receiver) {
      if (key !== 'push') {
        return Reflect.get(target, key, receiver) as unknown;
      }
      // The base push never calls the replacement, so a listener that wraps it cannot loop.
      if (push === undefined) {
        return pushRecords;
      }
      const replacement = push;
      return (...records: unknown[][]): number => replacement.apply(receiver, records.map(wrap));
    },
    set(target, key, value, receiver) {
      if (key === 'push') {
        const replacement: unknown = value;
        if (typeof replacement === 'function') {
          push = (...records) => Number(Reflect.apply(replacement, receiver, records));
        }
        return true;
      }
      return Reflect.set(target, key, value, receiver);
    },
  });
  Reflect.set(self, '$idlip', boot);
}

export const test = base.extend<{ problems: string[]; expectedProblems: number }>({
  // A test that provokes errors on purpose sets the count it expects.
  expectedProblems: [0, { option: true }],
  problems: [
    async ({ page, expectedProblems }, use) => {
      const problems: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') {
          problems.push(`console error: ${message.text()}`);
        }
      });
      page.on('pageerror', (error) => {
        problems.push(`page error: ${error.message}`);
      });
      page.on('requestfailed', (request) => {
        problems.push(`request failed: ${request.url()}`);
      });
      page.on('response', (response) => {
        if (response.status() >= 400) {
          problems.push(`HTTP ${response.status()}: ${response.url()}`);
        }
      });
      await page.addInitScript(watchState);
      await use(problems);
      // Any console error or failed request fails the test.
      expect(problems).toHaveLength(expectedProblems);
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Returns a label for every request but page navigations while the action runs: the chunk name
 * for a chunk, the path for any other URL. An extra file under any URL shape shows up here.
 */
export async function collectRequests(page: Page, action: () => Promise<void>): Promise<string[]> {
  const names: string[] = [];
  function onRequest(request: Request): void {
    if (request.resourceType() === 'document') {
      return;
    }
    const url = new URL(request.url());
    names.push(getChunkName(request.url()) ?? `${url.pathname}${url.search}`);
  }
  page.on('request', onRequest);
  await action();
  page.off('request', onRequest);
  return names;
}

/**
 * Waits until the page has no pending request and has painted twice.
 */
export async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

export interface Todo {
  readonly id: string;
  readonly text: string;
  readonly done: boolean;
}

/**
 * Serializes a node with its attributes in name order. Patching can set an attribute in another
 * order than the server writes it, which is the same DOM.
 */
export function serializeNode(node: Node): string {
  if (node instanceof Element) {
    // The live `value`, `checked` and `selected` replace their attributes, which go stale.
    const pairs = new Map<string, string>();
    for (const attribute of node.attributes) {
      pairs.set(attribute.name, attribute.value);
    }
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
      if (pairs.has('value') || node.value !== '') {
        pairs.set('value', node.value);
      }
    }
    if (node instanceof HTMLInputElement && (node.type === 'checkbox' || node.type === 'radio')) {
      if (node.checked) {
        pairs.set('checked', '');
      } else {
        pairs.delete('checked');
      }
    }
    if (node instanceof HTMLOptionElement) {
      if (node.selected) {
        pairs.set('selected', '');
      } else {
        pairs.delete('selected');
      }
    }
    let text = `<${node.localName}`;
    for (const [name, value] of [...pairs].toSorted((a, b) => a[0].localeCompare(b[0]))) {
      text += ` ${name}="${value}"`;
    }
    let inner = '';
    for (const child of node.childNodes) {
      inner += serializeNode(child);
    }
    return `${text}>${inner}</${node.localName}>`;
  }
  if (node instanceof Comment) {
    return `<!--${node.data}-->`;
  }
  return node.textContent ?? '';
}

/**
 * Returns the `<main>` markup of the page, with sorted attributes.
 */
export async function readMain(page: Page): Promise<string> {
  return await page.locator('main').evaluate(serializeNode);
}

/**
 * Renders the page again on the server for these todos and returns its `<main>` markup,
 * parsed and serialized by a browser with scripts off, so it compares with the live DOM.
 */
export async function renderFresh(page: Page, todos: readonly Todo[]): Promise<string> {
  const props = encodeURIComponent(JSON.stringify({ initial: todos }));
  const response = await page.request.get(`/?props=${props}`);
  const html = await response.text();
  const context = await page.context().browser()?.newContext({ javaScriptEnabled: false });
  if (context === undefined) {
    throw new Error('The browser is closed');
  }
  const other = await context.newPage();
  await other.setContent(html);
  const markup = await readMain(other);
  await context.close();
  return markup;
}

export const initial: readonly Todo[] = [
  { id: 'a1', text: 'Write the format', done: true },
  { id: 'a2', text: 'Build <the> runtime', done: false },
];
