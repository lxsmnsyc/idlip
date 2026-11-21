export function toggle(model, [id]) {
  let { todos } = model;
  todos = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  return { ...model, todos };
}
