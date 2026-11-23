import { renderToResponse } from 'idlip/server';
import Board from './board.tsx';

interface Item {
  id: string;
  label: string;
  start: number;
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
function readProps(url: URL): { items: Item[] } {
  const given = url.searchParams.get('props');
  if (given === null) {
    return { items: initial };
  }
  const parsed: unknown = JSON.parse(given);
  const list: unknown =
    typeof parsed === 'object' && parsed !== null ? Reflect.get(parsed, 'items') : undefined;
  if (!Array.isArray(list) || !list.every(isItem)) {
    throw new TypeError('props.items must be an array of counters');
  }
  return {
    items: list.map((item) => ({ id: item.id, label: item.label, start: item.start })),
  };
}

const server = {
  // Nitro calls `fetch` for each request that is not a file of the build.
  async fetch(request: Request): Promise<Response> {
    return renderToResponse(Board, readProps(new URL(request.url)), { csp: true, preload: false });
  },
};

export default server;
