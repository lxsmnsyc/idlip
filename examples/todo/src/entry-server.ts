import { renderToResponse } from 'idlip/server';
import TodoApp from './todo.tsx';

interface Todo {
  id: string;
  text: string;
  done: boolean;
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
function readProps(url: URL): { initial: Todo[] } {
  const given = url.searchParams.get('props');
  if (given === null) {
    return { initial };
  }
  const parsed: unknown = JSON.parse(given);
  const list: unknown =
    typeof parsed === 'object' && parsed !== null ? Reflect.get(parsed, 'initial') : undefined;
  if (!Array.isArray(list) || !list.every(isTodo)) {
    throw new TypeError('props.initial must be an array of todos');
  }
  return { initial: list.map((todo) => ({ id: todo.id, text: todo.text, done: todo.done })) };
}

const server = {
  // Nitro calls `fetch` for each request that is not a file of the build. `?preload=off` leaves
  // the preload links out, so the first click loads its chunks.
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    return renderToResponse(TodoApp, readProps(url), {
      csp: true,
      preload: url.searchParams.get('preload') === 'off' ? false : {},
    });
  },
};

export default server;
