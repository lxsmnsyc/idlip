import { render as renderComponent, renderListener } from 'idlip/server';
import Board from './board.tsx';

interface Item {
  id: string;
  label: string;
  start: number;
}

export interface PageOptions {
  /** The URL of the loader module. Default: `idlip/client` through the dev server. */
  loader?: string;
  /** Written on every script of the page. */
  nonce?: string;
}

const initial: Item[] = [
  { id: 'a1', label: 'Apples', start: 0 },
  { id: 'a2', label: 'Pears <green>', start: 3 },
  { id: 'a3', label: 'Plums', start: 1 },
];

function isItem(value: unknown): value is Item {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'id') === 'string' &&
    typeof Reflect.get(value, 'label') === 'string' &&
    typeof Reflect.get(value, 'start') === 'number'
  );
}

/**
 * Reads the props from `?props=<json>`, such as `{"items":[...]}`, or returns the default counters.
 */
function readProps(url: string): { items: Item[] } {
  const given = new URL(url, 'http://localhost').searchParams.get('props');
  if (given === null) {
    return { items: initial };
  }
  const parsed: unknown = JSON.parse(given);
  const list: unknown =
    typeof parsed === 'object' && parsed !== null ? Reflect.get(parsed, 'items') : undefined;
  const items: Item[] = [];
  if (!Array.isArray(list)) {
    throw new TypeError('props.items must be an array of counters');
  }
  for (const item of list) {
    if (!isItem(item)) {
      throw new TypeError('props.items must be an array of counters');
    }
    items.push({ id: item.id, label: item.label, start: item.start });
  }
  return { items };
}

function writeNonce(nonce: string | undefined): string {
  return nonce === undefined ? '' : ` nonce="${nonce}"`;
}

/**
 * Renders the counters page for a request URL.
 */
export async function render(url: string, options: PageOptions = {}): Promise<string> {
  const { nonce } = options;
  const body = await renderComponent(Board, readProps(url), { nonce });
  const loader = options.loader ?? '/@id/idlip/client';
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1"><title>counters</title>` +
    renderListener({ nonce }) +
    `<script type="module" src="${loader}"${writeNonce(nonce)}></script>` +
    `</head><body>${body}</body></html>`
  );
}
