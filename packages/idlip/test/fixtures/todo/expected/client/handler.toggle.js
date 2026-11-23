import { getRows$ } from 'idlip/helpers';
export function toggle(model, [id]) {
  let { todos } = model;
  todos = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  return { ...model, todos };
}

const $e3_lists = { '3': 'todos' };

export function $e3($e, $c, { rendered }) {
const rows = getRows$($c, rendered, $e3_lists);
return [['toggle', [rows[0].item.id]]];
}
