import { render as renderComponent, renderListener } from 'idlip/server';
import TodoApp from './todo.idlip.tsx';

interface Todo {
  id: string;
  text: string;
  done: boolean;
}

export interface PageOptions {
  /** The URL of the loader module. Default: `idlip/client` through the dev server. */
  loader?: string;
  /** Written on every script of the page. */
  nonce?: string;
}

const initial: Todo[] = [
  { id: 'a1', text: 'Write the format', done: true },
  { id: 'a2', text: 'Build <the> runtime', done: false },
];

function isTodo(value: unknown): value is Todo {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'id') === 'string' &&
    typeof Reflect.get(value, 'text') === 'string' &&
    typeof Reflect.get(value, 'done') === 'boolean'
  );
}

/**
 * Reads the props from `?props=<json>`, such as `{"initial":[...]}`, or returns the default todos.
 */
function readProps(url: string): { initial: Todo[] } {
  const given = new URL(url, 'http://localhost').searchParams.get('props');
  if (given === null) {
    return { initial };
  }
  const parsed: unknown = JSON.parse(given);
  const list: unknown =
    typeof parsed === 'object' && parsed !== null ? Reflect.get(parsed, 'initial') : undefined;
  const todos: Todo[] = [];
  if (!Array.isArray(list)) {
    throw new TypeError('props.initial must be an array of todos');
  }
  for (const item of list) {
    if (!isTodo(item)) {
      throw new TypeError('props.initial must be an array of todos');
    }
    todos.push({ id: item.id, text: item.text, done: item.done });
  }
  return { initial: todos };
}

function writeNonce(nonce: string | undefined): string {
  return nonce === undefined ? '' : ` nonce="${nonce}"`;
}

/**
 * Renders the todo page for a request URL.
 */
export async function render(url: string, options: PageOptions = {}): Promise<string> {
  const { nonce } = options;
  const body = await renderComponent(TodoApp, readProps(url), { nonce });
  const loader = options.loader ?? '/@id/idlip/client';
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1"><title>todo</title>` +
    renderListener({ nonce }) +
    `<script type="module" src="${loader}"${writeNonce(nonce)}></script>` +
    `</head><body>${body}</body></html>`
  );
}
