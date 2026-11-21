export function add(model) {
  let { draft, todos } = model;
  if (draft === '') {
    return { ...model, draft, todos };
  }
  const text = draft;
  return {
    model: { ...model, draft, todos },
    task: { site: 'add$1', args: [], then: 'add$1', carried: [text] },
  };
}

export function add$1(model, [$outcome, text]) {
  let { draft, todos } = model;
  if (!$outcome.ok) {
    throw $outcome.error;
  }
  const id = $outcome.value;
  todos = [...todos, { id, text, done: false }];
  draft = '';
  return { ...model, draft, todos };
}
