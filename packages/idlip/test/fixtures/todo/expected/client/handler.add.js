export function add(model) {
  let { draft, todos, next } = model;
  if (draft === '') {
    return { ...model, draft, todos, next };
  }
  todos = [...todos, { id: `t${next}`, text: draft, done: false }];
  next = next + 1;
  draft = '';
  return { ...model, draft, todos, next };
}

export function $e0($e, $c) {
return [['add', []]];
}
